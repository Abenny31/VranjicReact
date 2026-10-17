using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class DatabaseErrorLoggingTests
{
    private static ErrorLogRedactor Redactor() => new(new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["Smtp:Password"] = "configured-test-secret" }).Build());

    [TestMethod]
    public async Task CapturesInnerExceptionAndAuthenticatedUser_WithoutRequestSecretsOrPublicDetails()
    {
        var context = Context();
        context.Request.Method = "POST";
        context.Request.Path = "/api/Account/me";
        context.Request.QueryString = new QueryString("?token=query-secret");
        context.Request.Headers.Authorization = "Bearer header-secret";
        context.Request.Headers.Cookie = "session=cookie-secret";
        context.Request.Body = new MemoryStream("password=body-secret"u8.ToArray());
        context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "user-123")], "test"));
        var writer = new RecordingWriter();
        var middleware = Middleware(_ => throw new InvalidOperationException("Controller failure", InnerFailure()));

        await middleware.InvokeAsync(context, writer);

        var entry = writer.Entries.Single();
        Assert.AreEqual("user-123", entry.UserId);
        Assert.AreEqual("/api/Account/me", entry.Path);
        Assert.AreEqual(500, entry.StatusCode);
        Assert.AreEqual("test-trace", entry.TraceId);
        Assert.IsTrue(entry.ExceptionDetails.Contains("Invalid object name 'AspNetUsers'", StringComparison.Ordinal));
        Assert.IsTrue(entry.ExceptionDetails.Contains(nameof(InnerFailure), StringComparison.Ordinal));
        foreach (var secret in new[] { "query-secret", "header-secret", "cookie-secret", "body-secret" })
            Assert.IsFalse(JsonSerializer.Serialize(entry).Contains(secret, StringComparison.Ordinal));
        Assert.AreEqual(0L, context.Request.Body.Position);
        Assert.AreEqual(500, context.Response.StatusCode);
        var response = await Body(context);
        Assert.IsTrue(response.Contains("test-trace", StringComparison.Ordinal));
        Assert.IsFalse(response.Contains("AspNetUsers", StringComparison.Ordinal));
        Assert.IsFalse(response.Contains("Controller failure", StringComparison.Ordinal));
    }

    [TestMethod]
    public async Task ControllerActivationFailureIsCaughtBeforeActionRuns()
    {
        var writer = new RecordingWriter();
        using var server = new TestServer(new WebHostBuilder()
            .ConfigureServices(services =>
            {
                services.AddSingleton(Redactor());
                services.AddSingleton<IErrorLogWriter>(writer);
                services.AddControllers().AddApplicationPart(typeof(ActivationFailureController).Assembly);
            })
            .Configure(app =>
            {
                app.UseMiddleware<DatabaseErrorLoggingMiddleware>();
                app.UseRouting();
                app.UseEndpoints(endpoints => endpoints.MapControllers());
            }));
        using var client = server.CreateClient();
        var response = await client.GetAsync("/error-log-test/activation");

        Assert.AreEqual(HttpStatusCode.InternalServerError, response.StatusCode);
        var entry = writer.Entries.Single();
        Assert.IsTrue(entry.Message.Contains(nameof(IMissingDependency), StringComparison.Ordinal));
        Assert.AreEqual("error-log-test/activation", entry.Path);
        Assert.IsNull(entry.UserId);
        Assert.IsFalse((await response.Content.ReadAsStringAsync()).Contains(nameof(IMissingDependency), StringComparison.Ordinal));
    }

    [TestMethod]
    public async Task DatabaseWriteFailureStillReturnsOriginalGeneric500()
    {
        var context = Context();
        await Middleware(_ => throw new InvalidOperationException("Original failure"))
            .InvokeAsync(context, new RecordingWriter { Fail = true });
        Assert.AreEqual(500, context.Response.StatusCode);
        var body = await Body(context);
        Assert.IsTrue(body.Contains("test-trace", StringComparison.Ordinal));
        Assert.IsFalse(body.Contains("Logging database unavailable", StringComparison.Ordinal));
    }

    [TestMethod]
    [DataRow(200)]
    [DataRow(400)]
    [DataRow(401)]
    [DataRow(403)]
    [DataRow(404)]
    public async Task NormalResponsesAreUnchangedAndNotLogged(int statusCode)
    {
        var context = Context();
        var writer = new RecordingWriter();
        await Middleware(ctx => { ctx.Response.StatusCode = statusCode; return Task.CompletedTask; }).InvokeAsync(context, writer);
        Assert.AreEqual(statusCode, context.Response.StatusCode);
        Assert.AreEqual(0, writer.Entries.Count);
    }

    [TestMethod]
    public async Task ClientDisconnectAndBadRequestAreNotConvertedToServerErrors()
    {
        var context = Context();
        context.RequestAborted = new CancellationToken(canceled: true);
        var writer = new RecordingWriter();
        await Assert.ThrowsExactlyAsync<OperationCanceledException>(() =>
            Middleware(_ => throw new OperationCanceledException()).InvokeAsync(context, writer));
        await Assert.ThrowsExactlyAsync<BadHttpRequestException>(() =>
            Middleware(_ => throw new BadHttpRequestException("Bad request", 400)).InvokeAsync(Context(), writer));
        Assert.AreEqual(0, writer.Entries.Count);
    }

    [TestMethod]
    public async Task StartedResponseIsLoggedButNotOverwritten()
    {
        var context = Context();
        context.Features.Set<IHttpResponseFeature>(new StartedResponseFeature());
        var writer = new RecordingWriter();
        var original = new InvalidOperationException("Stream failed");
        var thrown = await Assert.ThrowsExactlyAsync<InvalidOperationException>(() =>
            Middleware(_ => throw original).InvokeAsync(context, writer));
        Assert.AreSame(original, thrown);
        Assert.AreEqual(1, writer.Entries.Count);
        Assert.AreEqual(202, context.Response.StatusCode);
    }

    [TestMethod]
    public void RedactsConfiguredSecretsCredentialsEmailsAndUrlQueries_ButKeepsDiagnosticNames()
    {
        var message = "Unable to resolve service 'UserNicknameService'. configured-test-secret " +
            "Password=sql-secret; Pwd='quoted secret'; Bearer abc.def.ghi " +
            "{\"accessToken\":\"access-secret\",\"refreshToken\":\"refresh-secret\"} " +
            "admin@example.test https://example.test/reset?code=url-secret";
        var result = Redactor().Sanitize(message, 4000);
        foreach (var secret in new[] { "configured-test-secret", "sql-secret", "quoted secret", "abc.def.ghi",
            "access-secret", "refresh-secret", "admin@example.test", "url-secret" })
            Assert.IsFalse(result.Contains(secret, StringComparison.Ordinal), secret);
        Assert.IsTrue(result.Contains("UserNicknameService", StringComparison.Ordinal));
        Assert.AreEqual(4000, Redactor().Sanitize(new string('a', 5000), 4000).Length);
    }

    private static DefaultHttpContext Context()
    {
        var context = new DefaultHttpContext { TraceIdentifier = "test-trace" };
        context.Response.Body = new MemoryStream();
        context.RequestServices = new ServiceCollection().AddLogging().BuildServiceProvider();
        return context;
    }

    private static DatabaseErrorLoggingMiddleware Middleware(RequestDelegate next) =>
        new(next, Redactor(), NullLogger<DatabaseErrorLoggingMiddleware>.Instance);

    private static async Task<string> Body(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return await new StreamReader(context.Response.Body, leaveOpen: true).ReadToEndAsync();
    }

    private static Exception InnerFailure()
    {
        try { throw new InvalidOperationException("Invalid object name 'AspNetUsers'."); }
        catch (Exception error) { return error; }
    }

    private sealed class RecordingWriter : IErrorLogWriter
    {
        public List<ErrorLog> Entries { get; } = [];
        public bool Fail { get; init; }
        public Task WriteAsync(ErrorLog entry, CancellationToken cancellationToken)
        {
            Assert.IsTrue(cancellationToken.CanBeCanceled);
            if (Fail) throw new InvalidOperationException("Logging database unavailable");
            Entries.Add(entry);
            return Task.CompletedTask;
        }
    }

    private sealed class StartedResponseFeature : HttpResponseFeature
    {
        public StartedResponseFeature() { StatusCode = 202; }
        public override bool HasStarted => true;
    }
}

public interface IMissingDependency;

[ApiController, Route("error-log-test/activation")]
public sealed class ActivationFailureController : ControllerBase
{
    public ActivationFailureController(IMissingDependency dependency) { }
    [HttpGet]
    public IActionResult Get() => Ok();
}
