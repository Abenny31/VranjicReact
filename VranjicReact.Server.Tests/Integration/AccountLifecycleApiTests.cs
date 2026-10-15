using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Integration;

public sealed partial class EditorialApiTests
{
    [TestMethod]
    public async Task ExistingSeed_IsMarkedAtStartupEvenWhenSeedingIsDisabled()
    {
        using var scope = _app!.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var email = Guid.NewGuid() + "@example.test";
        var seed = new IdentityUser { UserName = email, Email = email, EmailConfirmed = true };
        Assert.IsTrue((await users.CreateAsync(seed, Password)).Succeeded);
        Assert.IsTrue((await users.AddToRoleAsync(seed, RoleNames.SuperUser)).Succeeded);
        try
        {
            using (var upgraded = _app.WithWebHostBuilder(builder => builder.UseSetting("SeedAdminUser:Email", email)))
            using (var client = upgraded.CreateClient(new() { BaseAddress = new Uri("https://localhost") }))
                Assert.AreEqual(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
            Assert.IsTrue((await users.GetClaimsAsync(seed)).Any(c => c.Type == AccountProtectionService.SeedClaim && c.Value == "true"));
            // The original app has no configured seed email; persisted protection still applies.
            using var owner = await LoginAsync(RoleNames.SuperUser);
            Assert.AreEqual(HttpStatusCode.Conflict, (await owner.DeleteAsync($"/api/account/users/{seed.Id}")).StatusCode);
        }
        finally
        {
            using var cleanupScope = _app.Services.CreateScope();
            var cleanupUsers = cleanupScope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
            Assert.IsTrue((await cleanupUsers.DeleteAsync((await cleanupUsers.FindByIdAsync(seed.Id))!)).Succeeded);
        }
    }

    [TestMethod]
    public async Task Invitations_Disabled_AndPublicRegistrationClosed()
    {
        using var anonymous = Client();
        Assert.AreEqual(HttpStatusCode.Forbidden, (await anonymous.PostAsJsonAsync("/register", new { email = "closed@example.test", password = Password })).StatusCode);
        Assert.AreEqual(HttpStatusCode.ServiceUnavailable, (await anonymous.PostAsJsonAsync("/forgotPassword", new { email = "closed@example.test" })).StatusCode);
        using var owner = await LoginAsync(RoleNames.SuperUser);
        Assert.AreEqual(HttpStatusCode.ServiceUnavailable, (await owner.PostAsJsonAsync("/api/account/invitations", new { email = "closed@example.test", roles = new[] { RoleNames.Korisnik } })).StatusCode);
        using var scope = _app!.Services.CreateScope();
        Assert.IsNull(await scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>().FindByEmailAsync("closed@example.test"));
    }

    [TestMethod]
    public async Task SeedAccount_RemainsProtectedAfterEmailChange_AndOtherSuperUserCannotDeleteIt()
    {
        using var scope = _app!.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var seed = new IdentityUser { UserName = Guid.NewGuid() + "@example.test", EmailConfirmed = true };
        seed.Email = seed.UserName;
        Assert.IsTrue((await users.CreateAsync(seed, Password)).Succeeded);
        Assert.IsTrue((await users.AddToRoleAsync(seed, RoleNames.SuperUser)).Succeeded);
        await scope.ServiceProvider.GetRequiredService<AccountProtectionService>().MarkSeedAsync(seed);
        using var owner = await LoginAsync(RoleNames.SuperUser);
        var path = $"/api/account/users/{seed.Id}";
        var newEmail = Guid.NewGuid() + "@example.test";
        Assert.AreEqual(HttpStatusCode.OK, (await owner.PutAsJsonAsync(path, new { email = newEmail, emailConfirmed = true, roles = new[] { RoleNames.SuperUser } })).StatusCode);
        Assert.AreEqual(HttpStatusCode.Conflict, (await owner.DeleteAsync(path)).StatusCode);
        Assert.AreEqual(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(path, new { email = newEmail, emailConfirmed = true, roles = new[] { RoleNames.Administrator } })).StatusCode);
        Assert.AreEqual(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(path, new { email = newEmail, emailConfirmed = false, roles = new[] { RoleNames.SuperUser } })).StatusCode);
        var saved = await JsonAsync(await owner.GetAsync(path), HttpStatusCode.OK);
        Assert.IsTrue(saved.GetProperty("isProtected").GetBoolean());
        Assert.IsTrue(saved.GetProperty("emailConfirmed").GetBoolean());
        // Test-only cleanup, not the production API.
        using var cleanupScope = _app.Services.CreateScope();
        var cleanupUsers = cleanupScope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        Assert.IsTrue((await cleanupUsers.DeleteAsync((await cleanupUsers.FindByIdAsync(seed.Id))!)).Succeeded);
    }

    [TestMethod]
    public async Task LastSuperUser_CannotLoseRoleOrConfirmation_ButOrdinaryAccountsCanBeDeleted()
    {
        using var owner = await LoginAsync(RoleNames.SuperUser);
        using var scope = _app!.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var pending = new IdentityUser { UserName = Guid.NewGuid() + "@example.test" };
        pending.Email = pending.UserName;
        Assert.IsTrue((await users.CreateAsync(pending)).Succeeded);
        Assert.IsTrue((await users.AddToRoleAsync(pending, RoleNames.SuperUser)).Succeeded);
        var path = $"/api/account/users/{UserIds[RoleNames.SuperUser]}";
        Assert.AreEqual(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(path, new { email = "SuperUser@example.test", emailConfirmed = true, roles = new[] { RoleNames.Administrator } })).StatusCode);
        Assert.AreEqual(HttpStatusCode.Conflict, (await owner.PutAsJsonAsync(path, new { email = "SuperUser@example.test", emailConfirmed = false, roles = new[] { RoleNames.SuperUser } })).StatusCode);
        Assert.AreEqual(HttpStatusCode.Conflict, (await owner.DeleteAsync(path)).StatusCode);
        Assert.AreEqual(HttpStatusCode.NoContent, (await owner.DeleteAsync($"/api/account/users/{pending.Id}")).StatusCode);
        var ordinary = await JsonAsync(await owner.PostAsJsonAsync("/api/account/users", new { email = Guid.NewGuid() + "@example.test", password = Password, confirmEmail = true, roles = new[] { RoleNames.Korisnik } }), HttpStatusCode.Created);
        Assert.AreEqual(HttpStatusCode.NoContent, (await owner.DeleteAsync("/api/account/users/" + ordinary.GetProperty("id").GetString())).StatusCode);
    }

    [TestMethod]
    public async Task ConcurrentSuperUserDemotions_KeepOneUsableSuperUser()
    {
        using var owner = await LoginAsync(RoleNames.SuperUser);
        var email = Guid.NewGuid() + "@example.test";
        var created = await JsonAsync(await owner.PostAsJsonAsync("/api/account/users", new { email, password = Password, confirmEmail = true, roles = new[] { RoleNames.SuperUser } }), HttpStatusCode.Created);
        var id = created.GetProperty("id").GetString();
        try
        {
            var results = await Task.WhenAll(
                owner.PutAsJsonAsync($"/api/account/users/{UserIds[RoleNames.SuperUser]}", new { email = "SuperUser@example.test", emailConfirmed = true, roles = new[] { RoleNames.Administrator } }),
                owner.PutAsJsonAsync($"/api/account/users/{id}", new { email, emailConfirmed = true, roles = new[] { RoleNames.Administrator } }));
            CollectionAssert.AreEquivalent(new[] { HttpStatusCode.OK, HttpStatusCode.Conflict }, results.Select(result => result.StatusCode).ToArray());
            foreach (var result in results) result.Dispose();
        }
        finally
        {
            using var scope = _app!.Services.CreateScope();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
            var original = (await users.FindByIdAsync(UserIds[RoleNames.SuperUser]))!;
            if (!await users.IsInRoleAsync(original, RoleNames.SuperUser))
                Assert.IsTrue((await users.AddToRoleAsync(original, RoleNames.SuperUser)).Succeeded);
            Assert.IsTrue((await users.DeleteAsync((await users.FindByIdAsync(id!))!)).Succeeded);
        }
    }

    [TestMethod]
    public async Task Invitations_EnforceRoles_ResendInvalidatesOldToken_AndActivationIsSingleUse()
    {
        var mail = new RecordingAccountEmailSender();
        using var app = InvitationApplication(mail);
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var payload = new { email = Guid.NewGuid() + "@example.test", roles = new[] { RoleNames.Korisnik } };
        Assert.AreEqual(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/register", new { payload.email, password = Password })).StatusCode);
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/account/invitations", payload)).StatusCode);
        await AuthenticateInvitationClientAsync(client, RoleNames.Administrator);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/account/invitations", payload)).StatusCode);
        await AuthenticateInvitationClientAsync(client, RoleNames.SuperUser);
        var created = await JsonAsync(await client.PostAsJsonAsync("/api/account/invitations", payload), HttpStatusCode.OK);
        Assert.IsTrue(created.GetProperty("emailSent").GetBoolean());
        var id = created.GetProperty("userId").GetString();
        var oldToken = mail.Token;
        Assert.AreEqual(HttpStatusCode.Conflict, (await client.PostAsync($"/api/account/users/{id}/approve", null)).StatusCode);
        Assert.AreEqual(HttpStatusCode.OK, (await client.PostAsync($"/api/account/invitations/{id}/resend", null)).StatusCode);
        Assert.AreNotEqual(oldToken, mail.Token);
        client.DefaultRequestHeaders.Authorization = null;
        Assert.AreEqual(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/invitations/accept", new { userId = id, token = oldToken, password = Password })).StatusCode);
        Assert.AreEqual(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/invitations/accept", new { userId = id, token = mail.Token, password = "x" })).StatusCode);
        var acceptance = new { userId = id, token = mail.Token, password = Password, roles = new[] { RoleNames.SuperUser } };
        Assert.AreEqual(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/account/invitations/accept", acceptance)).StatusCode);
        Assert.AreEqual(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/invitations/accept", acceptance)).StatusCode);
        var login = await JsonAsync(await client.PostAsJsonAsync("/login", new { payload.email, password = Password }), HttpStatusCode.OK);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.GetProperty("accessToken").GetString());
        var profile = await JsonAsync(await client.GetAsync("/api/account/me"), HttpStatusCode.OK);
        CollectionAssert.AreEqual(new[] { RoleNames.Korisnik }, profile.GetProperty("roles").EnumerateArray().Select(r => r.GetString()).ToArray());
    }

    [TestMethod]
    public async Task Invitations_DeliveryFailureLeavesRetryableAccount_ExpiredTokenIsRejected()
    {
        var mail = new RecordingAccountEmailSender { Fail = true };
        using var app = InvitationApplication(mail);
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await AuthenticateInvitationClientAsync(client, RoleNames.SuperUser);
        var result = await JsonAsync(await client.PostAsJsonAsync("/api/account/invitations", new { email = Guid.NewGuid() + "@example.test", roles = new[] { RoleNames.Korisnik } }), HttpStatusCode.OK);
        Assert.IsFalse(result.GetProperty("emailSent").GetBoolean());
        var id = result.GetProperty("userId").GetString();
        mail.Fail = false;
        Assert.AreEqual(HttpStatusCode.OK, (await client.PostAsync($"/api/account/invitations/{id}/resend", null)).StatusCode);
        var tokenOptions = app.Services.GetRequiredService<IOptions<DataProtectionTokenProviderOptions>>().Value;
        tokenOptions.TokenLifespan = TimeSpan.FromSeconds(-1);
        Assert.AreEqual(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/invitations/accept", new { userId = id, token = mail.Token, password = Password })).StatusCode);
    }

    private static async Task AuthenticateInvitationClientAsync(HttpClient client, string role)
    {
        client.DefaultRequestHeaders.Authorization = null;
        var login = await JsonAsync(await client.PostAsJsonAsync("/login", new { email = role + "@example.test", password = Password }), HttpStatusCode.OK);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.GetProperty("accessToken").GetString());
    }

    private static WebApplicationFactory<Program> InvitationApplication(RecordingAccountEmailSender mail) => _app!.WithWebHostBuilder(builder =>
        builder.ConfigureServices(services =>
        {
            services.PostConfigure<AccountEmailOptions>(options =>
            {
                options.Enabled = true; options.PublicBaseUrl = "https://frontend.example.test";
                options.Host = "smtp.example.test"; options.UserName = "test"; options.Password = "test"; options.FromAddress = "test@example.test";
            });
            services.RemoveAll<IAccountEmailSender>();
            services.AddSingleton<IAccountEmailSender>(mail);
        }));

    private sealed class RecordingAccountEmailSender : IAccountEmailSender
    {
        public string Token { get; private set; } = string.Empty;
        public bool Fail { get; set; }
        public Task SendInvitationAsync(string email, string link, CancellationToken ct)
        {
            Token = QueryHelpers.ParseQuery(new Uri(link).Fragment.TrimStart('#'))["token"].ToString();
            return Fail ? Task.FromException(new System.Net.Mail.SmtpException("Simulated delivery failure")) : Task.CompletedTask;
        }
        public Task SendConfirmationLinkAsync(IdentityUser user, string email, string link) => Task.CompletedTask;
        public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string link) => Task.CompletedTask;
        public Task SendPasswordResetCodeAsync(IdentityUser user, string email, string code) => Task.CompletedTask;
    }
}
