using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Integration;

public sealed partial class EditorialApiTests
{
    [TestMethod]
    public async Task AccountProfileActivationFailure_IsSavedInErrorLog_AfterSuccessfulLogin()
    {
        // Reproduce a missing controller dependency while keeping Identity login operational.
        using var failingApp = (_app ?? throw new InvalidOperationException()).WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.RemoveAll<UserNicknameService>()));
        using var client = failingApp.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        using var scope = failingApp.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var before = await db.ErrorLogs.CountAsync();
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Account/me")).StatusCode);
        Assert.AreEqual(before, await db.ErrorLogs.CountAsync());

        var login = await JsonAsync(await client.PostAsJsonAsync("/login", new
        {
            email = RoleNames.SuperUser + "@example.test", password = Password
        }), HttpStatusCode.OK);
        var accessToken = login.GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var response = await JsonAsync(await client.GetAsync("/api/Account/me?token=must-not-be-logged"), HttpStatusCode.InternalServerError);
        var traceId = response.GetProperty("traceId").GetString();
        var entry = await db.ErrorLogs.AsNoTracking().SingleAsync(e => e.TraceId == traceId);

        Assert.AreEqual(UserIds[RoleNames.SuperUser], entry.UserId);
        Assert.AreEqual(500, entry.StatusCode);
        StringAssert.Contains(entry.Message, nameof(UserNicknameService));
        StringAssert.Contains(entry.ExceptionDetails, "InvalidOperationException");
        Assert.IsFalse(entry.Path.Contains('?'));
        Assert.IsFalse(entry.ExceptionDetails.Contains(Password, StringComparison.Ordinal));
        Assert.IsFalse(entry.ExceptionDetails.Contains(accessToken!, StringComparison.Ordinal));
        Assert.IsFalse(response.ToString().Contains(nameof(UserNicknameService), StringComparison.Ordinal));
        Assert.AreEqual(before + 1, await db.ErrorLogs.CountAsync());
    }
}
