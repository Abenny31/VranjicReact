using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Integration;

[TestClass]
public sealed class TranslationApiTests
{
    [TestMethod]
    [DataRow(null, 401)]
    [DataRow("Gost", 403)]
    [DataRow("Provjeravatelj", 403)]
    [DataRow("Korisnik", 200)]
    [DataRow("Moderator", 200)]
    [DataRow("Administrator", 200)]
    [DataRow("SuperUser", 200)]
    public async Task Translate_EnforcesContentCreatePolicy(string? role, int expected)
    {
        using var app = new TranslationApplication();
        using var client = Client(app, role);
        using var response = await client.PostAsJsonAsync("/api/moderation/translate", new TranslateRequest("Pozdrav"));
        Assert.AreEqual((HttpStatusCode)expected, response.StatusCode);
        Assert.AreEqual(expected == 200 ? 1 : 0, app.Translation.Calls);
        if (expected == 200) Assert.AreEqual("Hello", (await response.Content.ReadFromJsonAsync<TranslateResponse>())?.Text);
    }

    [TestMethod]
    public async Task Translate_ValidatesBeforeCallingProvider()
    {
        using var app = new TranslationApplication();
        using var client = Client(app, "Korisnik");
        foreach (var payload in new[]
        {
            new TranslateRequest(""), new TranslateRequest("  "), new TranslateRequest(new string('x', 10001)),
            new TranslateRequest("Text", "en", "hr"), new TranslateRequest("Text", "hr", "bad@"),
        })
        {
            using var response = await client.PostAsJsonAsync("/api/moderation/translate", payload);
            Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
        }
        Assert.AreEqual(0, app.Translation.Calls);
    }

    [TestMethod]
    [DataRow(TranslationFailure.Configuration, 503)]
    [DataRow(TranslationFailure.RateLimit, 429)]
    [DataRow(TranslationFailure.Timeout, 504)]
    [DataRow(TranslationFailure.Unavailable, 502)]
    [DataRow(TranslationFailure.InvalidResponse, 502)]
    public async Task Translate_ReturnsSafeError(TranslationFailure failure, int expected)
    {
        using var app = new TranslationApplication();
        app.Translation.Failure = failure;
        using var client = Client(app, "Administrator");
        using var response = await client.PostAsJsonAsync("/api/moderation/translate", new TranslateRequest("Pozdrav"));
        Assert.AreEqual((HttpStatusCode)expected, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.IsNotNull(body);
        Assert.IsTrue(body.ContainsKey("message"));
        Assert.IsFalse(string.IsNullOrWhiteSpace(body["message"]));
    }

    private static HttpClient Client(TranslationApplication app, string? role)
    {
        var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        if (role is not null) client.DefaultRequestHeaders.Add("TestRole", role);
        return client;
    }

    private sealed class TranslationApplication : WebApplicationFactory<Program>
    {
        public StubTranslation Translation { get; } = new();
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("SeedAdminUser:Enabled", "false");
            builder.UseSetting("AllowedHosts", "localhost");
            // This endpoint never opens a database connection.
            builder.UseSetting("ConnectionStrings:DefaultConnection", "Server=unused;Database=unused;Integrated Security=true");
            builder.ConfigureServices(services =>
            {
                services.AddDataProtection().UseEphemeralDataProtectionProvider();
                services.RemoveAll<ITranslationService>();
                services.AddSingleton<ITranslationService>(Translation);
                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = "Test";
                    options.DefaultChallengeScheme = "Test";
                    options.DefaultForbidScheme = "Test";
                }).AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>("Test", _ => { });
            });
        }
    }

    private sealed class StubTranslation : ITranslationService
    {
        public int Calls { get; private set; }
        public TranslationFailure? Failure { get; set; }
        public Task<string> TranslateAsync(string text, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken = default)
        {
            Calls++;
            Assert.AreEqual("hr", sourceLanguage);
            Assert.AreEqual("en", targetLanguage);
            if (Failure.HasValue) throw new TranslationException(Failure.Value);
            return Task.FromResult("Hello");
        }
    }

    private sealed class TestAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger, UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var role = Request.Headers["TestRole"].ToString();
            if (string.IsNullOrEmpty(role)) return Task.FromResult(AuthenticateResult.NoResult());
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "test-user"), new Claim(ClaimTypes.Role, role)], Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
        }
    }
}
