using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Integration;

// Reuse the opt-in, disposable LocalDB fixture and real Bearer login from EditorialApiTests.
public sealed partial class EditorialApiTests
{
    [TestMethod]
    [DataRow("/api/account/users")]
    [DataRow("/api/contact/messages")]
    [DataRow("/api/moderator-assignments")]
    public async Task AdministrativeLists_EnforceExistingRoles(string route)
    {
        using var anonymous = Client();
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(route + "?page=2&search=test")).StatusCode);
        foreach (var role in new[] { RoleNames.Gost, RoleNames.Korisnik, RoleNames.Moderator })
        {
            using var denied = await LoginAsync(role);
            Assert.AreEqual(HttpStatusCode.Forbidden, (await denied.GetAsync(route + "?page=2&search=test")).StatusCode);
        }
        foreach (var role in new[] { RoleNames.Administrator, RoleNames.SuperUser })
        {
            using var allowed = await LoginAsync(role);
            using var response = await allowed.GetAsync(route + "?limit=1");
            Assert.AreEqual(JsonValueKind.Array, (await JsonAsync(response, HttpStatusCode.OK)).ValueKind);
            Assert.IsTrue(response.Headers.Contains(ListPagination.HasMoreHeader));
        }
    }

    [TestMethod]
    [DataRow("/api/account/users")]
    [DataRow("/api/contact/messages")]
    public async Task AdministrativeLists_RejectInvalidPagingAndFilters(string route)
    {
        using var admin = await LoginAsync(RoleNames.Administrator);
        foreach (var query in new[] { "page=0", "page=-1", "page=10001", "page=invalid", "limit=0", "limit=201", "search=" + new string('x', 201),
            route.Contains("account") ? "emailConfirmed=invalid" : "processed=invalid" })
            Assert.AreEqual(HttpStatusCode.BadRequest, (await admin.GetAsync(route + "?" + query)).StatusCode);
        if (route.Contains("account"))
            Assert.AreEqual(HttpStatusCode.BadRequest, (await admin.GetAsync(route + "?role=" + new string('x', 65))).StatusCode);
    }

    [TestMethod]
    public async Task Users_FilterBeforePagination_ReturnRolesWithoutIdentitySecrets_AndFindOlderModerators()
    {
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var prefix = "directory-" + Guid.NewGuid().ToString("N");
        var moderatorRoleId = await db.Roles.Where(role => role.Name == RoleNames.Moderator).Select(role => role.Id).SingleAsync();
        var guestRoleId = await db.Roles.Where(role => role.Name == RoleNames.Gost).Select(role => role.Id).SingleAsync();
        for (var index = 0; index < 207; index++)
        {
            var email = $"{prefix}-{index:D3}@example.test";
            var user = new IdentityUser { Email = email, UserName = email, NormalizedEmail = email.ToUpperInvariant(),
                NormalizedUserName = email.ToUpperInvariant(), EmailConfirmed = index >= 203 };
            db.Users.Add(user);
            db.UserRoles.Add(new IdentityUserRole<string> { UserId = user.Id, RoleId = index < 205 ? moderatorRoleId : guestRoleId });
            if (index == 0) db.UserRoles.Add(new IdentityUserRole<string> { UserId = user.Id, RoleId = guestRoleId });
        }
        await db.SaveChangesAsync();
        using var admin = await LoginAsync(RoleNames.Administrator);
        var query = $"/api/account/users?search={prefix.ToUpperInvariant()}&role=moderator&emailConfirmed=false";
        var ids = new List<string>();
        for (var page = 1; page <= 4; page++)
        {
            using var response = await admin.GetAsync(query + $"&limit=100&page={page}");
            var rows = await JsonAsync(response, HttpStatusCode.OK);
            Assert.AreEqual(page < 3 ? 100 : page == 3 ? 3 : 0, rows.GetArrayLength());
            Assert.AreEqual(page < 3 ? "true" : "false", response.Headers.GetValues(ListPagination.HasMoreHeader).Single());
            foreach (var row in rows.EnumerateArray())
            {
                ids.Add(row.GetProperty("id").GetString()!);
                Assert.IsFalse(row.GetProperty("emailConfirmed").GetBoolean());
                Assert.IsTrue(row.GetProperty("roles").EnumerateArray().Any(role => role.GetString() == RoleNames.Moderator));
                CollectionAssert.AreEquivalent(new[] { "id", "email", "emailConfirmed", "roles", "isProtected", "invitationPending" }, row.EnumerateObject().Select(property => property.Name).ToArray());
                Assert.IsFalse(row.GetProperty("isProtected").GetBoolean());
                Assert.IsFalse(row.GetProperty("invitationPending").GetBoolean());
            }
        }
        Assert.AreEqual(203, ids.Distinct().Count());
        var first = await JsonAsync(await admin.GetAsync(query + "&limit=1"), HttpStatusCode.OK);
        CollectionAssert.AreEquivalent(new[] { RoleNames.Moderator, RoleNames.Gost }, first[0].GetProperty("roles").EnumerateArray().Select(role => role.GetString()).ToArray());
        var older = await JsonAsync(await admin.GetAsync($"/api/account/users?search={prefix}-204&role=Moderator&emailConfirmed=true"), HttpStatusCode.OK);
        Assert.AreEqual(1, older.GetArrayLength());
        var unknownRole = await JsonAsync(await admin.GetAsync($"/api/account/users?search={prefix}&role=Unknown"), HttpStatusCode.OK);
        Assert.AreEqual(0, unknownRole.GetArrayLength());
        using var defaults = await admin.GetAsync($"/api/account/users?search={prefix}");
        Assert.AreEqual(100, (await JsonAsync(defaults, HttpStatusCode.OK)).GetArrayLength());
        Assert.AreEqual("true", defaults.Headers.GetValues(ListPagination.HasMoreHeader).Single());
    }

    [TestMethod]
    public async Task ContactMessages_FilterBeforePaging_StableOrder_AndRefreshAfterActions()
    {
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var prefix = "contact-" + Guid.NewGuid().ToString("N");
        var timestamp = DateTime.UtcNow.AddDays(-1);
        var messages = Enumerable.Range(0, 207).Select(index => new ContactMessage
        {
            Name = prefix, Email = $"person-{index}@example.test", Message = "Fixture body " + index,
            SubmittedAt = timestamp, Archived = index == 206, ProcessedAt = index == 205 ? timestamp : null,
        }).ToArray();
        db.ContactMessages.AddRange(messages);
        await db.SaveChangesAsync();
        using var admin = await LoginAsync(RoleNames.Administrator);
        var query = $"/api/contact/messages?search={prefix}&archived=false&processed=false";
        var ids = new List<int>();
        for (var page = 1; page <= 4; page++)
        {
            using var response = await admin.GetAsync(query + $"&page={page}&limit=100");
            var rows = await JsonAsync(response, HttpStatusCode.OK);
            Assert.AreEqual(page < 3 ? 100 : page == 3 ? 5 : 0, rows.GetArrayLength());
            Assert.AreEqual(page < 3 ? "true" : "false", response.Headers.GetValues(ListPagination.HasMoreHeader).Single());
            ids.AddRange(rows.EnumerateArray().Select(row => row.GetProperty("id").GetInt32()));
        }
        CollectionAssert.AreEqual(messages.Take(205).Select(message => message.Id).OrderDescending().ToArray(), ids.ToArray());
        var processed = await JsonAsync(await admin.GetAsync($"/api/contact/messages?search={prefix}&processed=true"), HttpStatusCode.OK);
        Assert.AreEqual(messages[205].Id, processed[0].GetProperty("id").GetInt32());
        Assert.AreEqual(1, processed.GetArrayLength());
        var archived = await JsonAsync(await admin.GetAsync($"/api/contact/messages?search={prefix}&archived=true"), HttpStatusCode.OK);
        Assert.AreEqual(messages[206].Id, archived[0].GetProperty("id").GetInt32());
        Assert.AreEqual(1, archived.GetArrayLength());
        Assert.AreEqual(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/contact/{messages[0].Id}/process", null)).StatusCode);
        Assert.AreEqual(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync($"/api/contact/{messages[1].Id}/archive", new { archived = true })).StatusCode);
        var lastPage = await JsonAsync(await admin.GetAsync(query + "&page=3&limit=100"), HttpStatusCode.OK);
        Assert.AreEqual(3, lastPage.GetArrayLength());
        using var defaults = await admin.GetAsync($"/api/contact/messages?search={prefix}");
        Assert.AreEqual(100, (await JsonAsync(defaults, HttpStatusCode.OK)).GetArrayLength());
        Assert.AreEqual("true", defaults.Headers.GetValues(ListPagination.HasMoreHeader).Single());
        // Contains must treat search punctuation as literal input, not SQL wildcards.
        var literal = await JsonAsync(await admin.GetAsync($"/api/contact/messages?search={prefix}%25"), HttpStatusCode.OK);
        Assert.AreEqual(0, literal.GetArrayLength());
        using var moderator = await LoginAsync(RoleNames.Moderator);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await moderator.PostAsync($"/api/contact/{messages[2].Id}/process", null)).StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await moderator.PostAsJsonAsync($"/api/contact/{messages[2].Id}/archive", new { archived = true })).StatusCode);
    }
}
