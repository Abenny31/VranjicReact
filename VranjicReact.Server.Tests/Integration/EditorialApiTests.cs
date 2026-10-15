using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Integration;

// Opt-in real SQL Server tests. Never read a connection string from application configuration.
[TestClass, DoNotParallelize, TestCategory("SqlIntegration")]
public sealed partial class EditorialApiTests
{
    private static readonly string DatabaseName = "DFB_Test_" + Guid.NewGuid().ToString("N");
    private static readonly string TestConnectionString = $"Server=(localdb)\\mssqllocaldb;Database={DatabaseName};Trusted_Connection=True;MultipleActiveResultSets=true";
    private static readonly string Password = "Test9" + Guid.NewGuid().ToString("N");
    private static TestApplication? _app;
    private static readonly Dictionary<string, string> UserIds = new();
    private static int _areaId;
    private static int _otherAreaId;

    [ClassInitialize]
    public static async Task Initialize(TestContext context)
    {
        if (Environment.GetEnvironmentVariable("DFB_RUN_SQL_TESTS") != "1")
            Assert.Inconclusive("Set DFB_RUN_SQL_TESTS=1 to run against a disposable LocalDB database.");
        _app = new TestApplication();
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        await db.GetService<IMigrator>().MigrateAsync("20260924205519_AddEditorialModerationWorkflow");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO [GalleryAlbums] ([Title], [CreatedAt]) VALUES (N'Legacy album', '2020-01-01');");
        await db.Database.MigrateAsync();
        var legacy = await db.GalleryAlbums.SingleAsync(a => a.Title == "Legacy album");
        Assert.AreEqual(EditorialStatus.Published, legacy.EditorialStatus);
        Assert.AreEqual(legacy.CreatedAt, legacy.PublishedAt);
        Assert.IsNull(legacy.EventDate);
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        foreach (var role in new[] { RoleNames.SuperUser, RoleNames.Administrator, RoleNames.Korisnik, RoleNames.Moderator, RoleNames.Gost })
        {
            if (!await roles.RoleExistsAsync(role)) Assert.IsTrue((await roles.CreateAsync(new IdentityRole(role))).Succeeded);
            var user = new IdentityUser { UserName = role + "@example.test", Email = role + "@example.test", EmailConfirmed = true };
            Assert.IsTrue((await users.CreateAsync(user, Password)).Succeeded);
            Assert.IsTrue((await users.AddToRoleAsync(user, role)).Succeeded);
            UserIds[role] = user.Id;
        }
        using var admin = await LoginAsync(RoleNames.SuperUser);
        var area = await JsonAsync(await admin.PostAsJsonAsync("/api/areas", new { name = "Test area", slug = "test-area", isActive = true }), HttpStatusCode.Created);
        _areaId = area.GetProperty("id").GetInt32();
        var other = await JsonAsync(await admin.PostAsJsonAsync("/api/areas", new { name = "Other area", slug = "other-area", isActive = true }), HttpStatusCode.Created);
        _otherAreaId = other.GetProperty("id").GetInt32();
        await JsonAsync(await admin.PostAsJsonAsync("/api/moderator-assignments", new { userId = UserIds[RoleNames.Moderator], areaId = _areaId }), HttpStatusCode.Created);
    }

    [ClassCleanup]
    public static async Task Cleanup()
    {
        if (_app is null) return;
        try
        {
            using var scope = _app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
            // Both exact generated name and prefix must match before deleting the disposable database.
            Assert.IsTrue(DatabaseName.StartsWith("DFB_Test_", StringComparison.Ordinal));
            Assert.AreEqual(DatabaseName, db.Database.GetDbConnection().Database);
            await db.Database.EnsureDeletedAsync();
        }
        finally { await _app.DisposeAsync(); }
    }

    [TestMethod]
    [DataRow("news", "/api/news")]
    [DataRow("blog", "/api/blog")]
    [DataRow("announcement", "/api/announcements")]
    [DataRow("gallery", "/api/gallery/albums")]
    public async Task FullWorkflow_EnforcesRolesVersionsAndReset(string type, string route)
    {
        using var anonymous = Client();
        using var author = await LoginAsync(RoleNames.Korisnik);
        using var moderator = await LoginAsync(RoleNames.Moderator);
        using var admin = await LoginAsync(RoleNames.Administrator);
        var payload = Payload(type, _areaId);
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync(route, payload)).StatusCode);
        var created = await JsonAsync(await author.PostAsJsonAsync(route, payload), HttpStatusCode.Created);
        int id = created.GetProperty("id").GetInt32();
        string version = created.GetProperty("rowVersion").GetString()!;
        var command = $"/api/moderation/{type}/{id}";
        Assert.AreEqual("Draft", created.GetProperty("editorialStatus").GetString());
        Assert.AreEqual(HttpStatusCode.NotFound, (await anonymous.GetAsync($"{route}/{id}?includeUnpublished=true")).StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await author.PostAsJsonAsync(command + "/publish", new { rowVersion = version })).StatusCode);
        Assert.AreEqual(HttpStatusCode.NoContent, (await author.PostAsJsonAsync(command + "/submit", new { rowVersion = version })).StatusCode);
        var queue = await JsonAsync(await moderator.GetAsync("/api/moderation/queue"), HttpStatusCode.OK);
        Assert.IsTrue(queue.EnumerateArray().Any(a => a.GetProperty("id").GetInt32() == id
            && a.GetProperty("contentType").GetString()!.Equals(type, StringComparison.OrdinalIgnoreCase)));
        Assert.AreEqual(HttpStatusCode.Conflict, (await moderator.PostAsJsonAsync(command + "/decision", new { rowVersion = version, decision = "Approve" })).StatusCode);
        version = await VersionAsync(admin, route, id, type);
        Assert.AreEqual(HttpStatusCode.NoContent, (await moderator.PostAsJsonAsync(command + "/decision", new { rowVersion = version, decision = "Approve" })).StatusCode);
        version = await VersionAsync(admin, route, id, type);
        Assert.AreEqual(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync(command + "/publish", new { rowVersion = version })).StatusCode);
        Assert.AreEqual(HttpStatusCode.OK, (await anonymous.GetAsync($"{route}/{id}")).StatusCode);
        var history = await JsonAsync(await author.GetAsync(command + "/history"), HttpStatusCode.OK);
        Assert.AreEqual(3, history.GetProperty("items").GetArrayLength());
        version = await VersionAsync(admin, route, id, type);
        payload["rowVersion"] = version; payload["title"] = "Edited " + Guid.NewGuid().ToString("N");
        Assert.AreEqual(type == "gallery" ? HttpStatusCode.NoContent : HttpStatusCode.OK,
            (await admin.PutAsJsonAsync($"{route}/{id}", payload)).StatusCode);
        var updated = await DetailAsync(admin, route, id, type);
        Assert.AreEqual("Draft", updated.GetProperty("editorialStatus").GetString());
        Assert.AreEqual(HttpStatusCode.NotFound, (await anonymous.GetAsync($"{route}/{id}")).StatusCode);
        var audit = await JsonAsync(await admin.GetAsync(command + "/history"), HttpStatusCode.OK);
        Assert.AreEqual("ApprovalReset", audit.GetProperty("items")[0].GetProperty("action").GetString());
    }

    [TestMethod]
    public async Task OtherArea_OwnContent_AndForgedAreaAreForbidden()
    {
        using var author = await LoginAsync(RoleNames.Korisnik);
        using var moderator = await LoginAsync(RoleNames.Moderator);
        using var admin = await LoginAsync(RoleNames.Administrator);
        foreach (var area in new[] { _otherAreaId, _areaId })
        {
            var creator = area == _areaId ? moderator : author;
            var post = await JsonAsync(await creator.PostAsJsonAsync("/api/announcements", Payload("announcement", area)), HttpStatusCode.Created);
            var id = post.GetProperty("id").GetInt32();
            var command = $"/api/moderation/announcement/{id}";
            await creator.PostAsJsonAsync(command + "/submit", new { rowVersion = post.GetProperty("rowVersion").GetString() });
            var version = await VersionAsync(admin, "/api/announcements", id, "announcement");
            Assert.AreEqual(HttpStatusCode.Forbidden, (await moderator.PostAsJsonAsync(command + "/decision", new { rowVersion = version, decision = "Approve", areaId = _areaId })).StatusCode);
            var forged = Payload("announcement", _areaId); forged["rowVersion"] = version;
            Assert.AreEqual(HttpStatusCode.Forbidden, (await moderator.PutAsJsonAsync($"/api/announcements/{id}", forged)).StatusCode);
        }
    }

    [TestMethod]
    public async Task DirectPublication_IsAudited_AndUnifiedFeedExcludesDraftScheduledExpired()
    {
        using var admin = await LoginAsync(RoleNames.Administrator);
        using var anonymous = Client();
        foreach (var mode in new[] { "active", "draft", "future", "expired" })
        {
            var payload = Payload("announcement", _areaId);
            payload["title"] = "Feed-" + mode; payload["publishedAt"] = mode == "draft" ? null : DateTime.UtcNow.AddHours(-2);
            payload["startsAt"] = mode == "future" ? DateTime.UtcNow.AddDays(1) : DateTime.UtcNow.AddHours(-1);
            payload["expiresAt"] = mode == "expired" ? DateTime.UtcNow.AddMinutes(-1) : null;
            var result = await JsonAsync(await admin.PostAsJsonAsync("/api/announcements", payload), HttpStatusCode.Created);
            if (mode == "active")
            {
                var history = await JsonAsync(await admin.GetAsync($"/api/moderation/announcement/{result.GetProperty("id")}/history"), HttpStatusCode.OK);
                Assert.AreEqual("Published", history.GetProperty("items")[0].GetProperty("action").GetString());
            }
        }
        var feed = await JsonAsync(await anonymous.GetAsync("/api/updates?pageSize=100"), HttpStatusCode.OK);
        var titles = feed.GetProperty("items").EnumerateArray().Select(a => a.GetProperty("title").GetString()).ToList();
        CollectionAssert.Contains(titles, "Feed-active");
        foreach (var hidden in new[] { "Feed-draft", "Feed-future", "Feed-expired" }) CollectionAssert.DoesNotContain(titles, hidden);
        Assert.AreEqual(HttpStatusCode.BadRequest, (await anonymous.GetAsync("/api/updates?page=0")).StatusCode);
        Assert.AreEqual(HttpStatusCode.BadRequest, (await anonymous.GetAsync("/api/updates?kind=invalid")).StatusCode);
    }

    [TestMethod]
    public async Task GalleryMedia_AndEventYearRespectPublication()
    {
        using var author = await LoginAsync(RoleNames.Korisnik);
        using var admin = await LoginAsync(RoleNames.Administrator);
        using var anonymous = Client();
        var album = await JsonAsync(await author.PostAsJsonAsync("/api/gallery/albums", Payload("gallery", _areaId)), HttpStatusCode.Created);
        int albumId = album.GetProperty("id").GetInt32();
        var media = await JsonAsync(await author.PostAsJsonAsync("/api/gallery", new {
            title = "Test image", mediaType = "Image", contentType = "image/png", fileName = "test.png",
            base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", albumId,
        }), HttpStatusCode.Created);
        var path = $"/api/gallery/{media.GetProperty("id")}/media";
        Assert.AreEqual(HttpStatusCode.NotFound, (await anonymous.GetAsync(path)).StatusCode);
        Assert.AreEqual(HttpStatusCode.OK, (await author.GetAsync(path)).StatusCode);
        var version = await VersionAsync(admin, "/api/gallery/albums", albumId, "gallery");
        Assert.AreEqual(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync($"/api/moderation/gallery/{albumId}/publish", new { rowVersion = version })).StatusCode);
        Assert.AreEqual(HttpStatusCode.OK, (await anonymous.GetAsync(path)).StatusCode);
        var albums = await JsonAsync(await anonymous.GetAsync("/api/gallery/albums?year=1999"), HttpStatusCode.OK);
        Assert.IsTrue(albums.EnumerateArray().Any(a => a.GetProperty("id").GetInt32() == albumId));
        Assert.AreEqual(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync($"/api/moderation/gallery/{albumId}/archive", new { rowVersion = await VersionAsync(admin, "/api/gallery/albums", albumId, "gallery") })).StatusCode);
        Assert.AreEqual(HttpStatusCode.NotFound, (await anonymous.GetAsync(path)).StatusCode);
    }

    [TestMethod]
    public async Task AdministratorCannotAssignRoles()
    {
        using var admin = await LoginAsync(RoleNames.Administrator);
        var result = await admin.PostAsJsonAsync("/api/account/users", new { email = "forged@example.test", password = Password, roles = new[] { "Administrator" } });
        Assert.AreEqual(HttpStatusCode.Forbidden, result.StatusCode);
    }

    [TestMethod]
    public async Task AnonymousCannotReadOwnerlessDraft_AndForeignHistoryIsForbidden()
    {
        using var anonymous = Client();
        using var moderator = await LoginAsync(RoleNames.Moderator);
        using var author = await LoginAsync(RoleNames.Korisnik);
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var draft = new News { Title = "Ownerless draft", Slug = "ownerless-draft", Excerpt = "Private", Body = "Private", EditorialStatus = EditorialStatus.Draft };
        db.News.Add(draft); await db.SaveChangesAsync();
        Assert.AreEqual(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/news/{draft.Id}?includeUnpublished=true")).StatusCode);
        var post = await JsonAsync(await author.PostAsJsonAsync("/api/announcements", Payload("announcement", _otherAreaId)), HttpStatusCode.Created);
        var path = $"/api/moderation/announcement/{post.GetProperty("id")}/history";
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await moderator.GetAsync(path)).StatusCode);
        Assert.AreEqual(HttpStatusCode.OK, (await author.GetAsync(path)).StatusCode);
    }

    [TestMethod]
    public async Task ReadinessReportsMigratedDatabase_WithoutDetails()
    {
        using var client = Client();
        Assert.AreEqual("Healthy", await client.GetStringAsync("/health/live"));
        Assert.AreEqual("Healthy", await client.GetStringAsync("/health/ready"));
    }

    [TestMethod]
    public async Task EditorialFeed_PaginatesBeyond200_WithStableOrderAndCombinedFilters()
    {
        using var admin = await LoginAsync(RoleNames.Administrator);
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var prefix = "Paging-" + Guid.NewGuid().ToString("N");
        var timestamp = DateTime.UtcNow;
        db.News.AddRange(Enumerable.Range(1, 205).Select(i => new News
        {
            Title = $"{prefix}-{i}", Slug = $"{prefix}-{i}", Excerpt = "Excerpt", Body = "Body",
            EditorialStatus = EditorialStatus.Draft, CreatedAt = timestamp, CreatedByUserId = UserIds[RoleNames.Korisnik],
        }));
        db.Announcements.Add(new Announcement
        {
            Title = prefix, Slug = prefix, Summary = "Summary", Body = "Body", StartsAt = timestamp,
            EditorialStatus = EditorialStatus.Draft, CreatedAt = timestamp, CreatedByUserId = UserIds[RoleNames.Korisnik],
        });
        await db.SaveChangesAsync();
        var keys = new List<string>();
        for (var page = 1; page <= 3; page++)
        {
            var result = await JsonAsync(await admin.GetAsync($"/api/updates/editorial?search={prefix}&status=Draft&pageSize=100&page={page}"), HttpStatusCode.OK);
            Assert.AreEqual(page, result.GetProperty("page").GetInt32());
            Assert.AreEqual(page < 3, result.GetProperty("hasMore").GetBoolean());
            Assert.AreEqual(page < 3 ? 100 : 6, result.GetProperty("items").GetArrayLength());
            foreach (var item in result.GetProperty("items").EnumerateArray())
            {
                keys.Add($"{item.GetProperty("contentType")}:{item.GetProperty("id")}");
                Assert.IsTrue(item.GetProperty("canEdit").GetBoolean());
                Assert.IsTrue(item.GetProperty("canViewHistory").GetBoolean());
                Assert.IsFalse(item.TryGetProperty("body", out _));
            }
        }
        Assert.AreEqual(206, keys.Distinct().Count());
        StringAssert.StartsWith(keys[0], "Announcement:");
        var filtered = await JsonAsync(await admin.GetAsync($"/api/updates/editorial?search={prefix}&kind=Announcement&status=Draft&pageSize=1"), HttpStatusCode.OK);
        Assert.AreEqual(1, filtered.GetProperty("items").GetArrayLength());
        Assert.IsFalse(filtered.GetProperty("hasMore").GetBoolean());
        var empty = await JsonAsync(await admin.GetAsync($"/api/updates/editorial?search={prefix}&status=Published"), HttpStatusCode.OK);
        Assert.AreEqual(0, empty.GetProperty("items").GetArrayLength());
        foreach (var query in new[] { "page=0", "page=10001", "pageSize=101", "kind=Blog", "status=unknown", "status=1", "search=" + new string('a', 201) })
            Assert.AreEqual(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/updates/editorial?" + query)).StatusCode);
    }

    [TestMethod]
    public async Task EditorialFeed_EnforcesAuthenticationOwnershipAndHistoryPermissions()
    {
        using var anonymous = Client();
        using var guest = await LoginAsync(RoleNames.Gost);
        using var author = await LoginAsync(RoleNames.Korisnik);
        using var moderator = await LoginAsync(RoleNames.Moderator);
        Assert.AreEqual(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/updates/editorial")).StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await guest.GetAsync("/api/updates/editorial")).StatusCode);
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var prefix = "Visibility-" + Guid.NewGuid().ToString("N");
        foreach (var area in new[] { _areaId, _otherAreaId })
        foreach (var status in new[] { EditorialStatus.Draft, EditorialStatus.Published })
        {
            db.News.Add(new News
            {
                Title = $"{prefix}-{area}-{status}", Slug = $"{prefix}-{area}-{status}", Excerpt = "Excerpt", Body = "Body",
                EditorialStatus = status, PublishedAt = status == EditorialStatus.Published ? DateTime.UtcNow.AddMinutes(-1) : null,
                CreatedByUserId = UserIds[RoleNames.Korisnik], AreaId = area,
            });
        }
        await db.SaveChangesAsync();
        var own = await JsonAsync(await author.GetAsync($"/api/updates/editorial?search={prefix}"), HttpStatusCode.OK);
        Assert.AreEqual(4, own.GetProperty("items").GetArrayLength());
        foreach (var item in own.GetProperty("items").EnumerateArray())
        {
            Assert.IsTrue(item.GetProperty("canViewHistory").GetBoolean());
            var draft = item.GetProperty("editorialStatus").GetString() == "Draft";
            Assert.AreEqual(draft, item.GetProperty("canEdit").GetBoolean());
            Assert.AreEqual(draft, item.GetProperty("canSubmit").GetBoolean());
        }
        // A caller cannot acquire ownership or area rights by adding query parameters.
        var foreign = await JsonAsync(await moderator.GetAsync($"/api/updates/editorial?search={prefix}&userId={UserIds[RoleNames.Korisnik]}&areaId={_areaId}"), HttpStatusCode.OK);
        Assert.AreEqual(2, foreign.GetProperty("items").GetArrayLength());
        foreach (var item in foreign.GetProperty("items").EnumerateArray())
        {
            var assigned = item.GetProperty("title").GetString() == $"{prefix}-{_areaId}-Published";
            Assert.AreEqual(assigned, item.GetProperty("canViewHistory").GetBoolean());
            Assert.IsFalse(item.GetProperty("canEdit").GetBoolean());
            Assert.IsFalse(item.GetProperty("canSubmit").GetBoolean());
            Assert.AreEqual(assigned ? HttpStatusCode.OK : HttpStatusCode.Forbidden,
                (await moderator.GetAsync($"/api/moderation/news/{item.GetProperty("id")}/history")).StatusCode);
        }
    }

    [TestMethod]
    [DataRow("news", "/api/news")]
    [DataRow("blog", "/api/blog")]
    [DataRow("announcement", "/api/announcements")]
    [DataRow("gallery", "/api/gallery/albums")]
    public async Task LegacyLists_PageAfterVisibilityFilters_WithoutChangingArrayContract(string type, string route)
    {
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var prefix = "paged-" + Guid.NewGuid().ToString("N");
        var area = new Area { Name = prefix, Slug = prefix, IsActive = true };
        db.Areas.Add(area); await db.SaveChangesAsync();
        var timestamp = DateTime.UtcNow.AddMinutes(-1);
        for (var index = 0; index < 207; index++)
        {
            IEditorialContent content = type switch
            {
                "news" => new News { Title = prefix + index, Slug = prefix + index, Body = "Body", Excerpt = "Excerpt", CreatedAt = timestamp, AreaId = area.Id, CreatedByUserId = UserIds[RoleNames.Korisnik] },
                "blog" => new BlogPost { Title = prefix + index, Slug = prefix + index, Body = "Body", Excerpt = "Excerpt", CreatedAt = timestamp, AreaId = area.Id, CreatedByUserId = UserIds[RoleNames.Korisnik] },
                "announcement" => new Announcement { Title = prefix + index, Slug = prefix + index, Body = "Body", Summary = "Summary", StartsAt = timestamp, CreatedAt = timestamp, AreaId = area.Id, CreatedByUserId = UserIds[RoleNames.Korisnik] },
                _ => new GalleryAlbum { Title = prefix + index, EventDate = new DateOnly(1988, 6, 12), CreatedAt = timestamp, AreaId = area.Id, CreatedByUserId = UserIds[RoleNames.Korisnik] },
            };
            content.EditorialStatus = index == 205 ? EditorialStatus.Draft : EditorialStatus.Published;
            content.PublishedAt = index == 205 ? null : index == 206 ? timestamp.AddDays(2) : timestamp;
            db.Add(content);
        }
        await db.SaveChangesAsync();
        using var anonymous = Client();
        using var author = await LoginAsync(RoleNames.Korisnik);
        using var moderator = await LoginAsync(RoleNames.Moderator);
        var ids = new List<int>();
        for (var page = 1; page <= 4; page++)
        {
            using var response = await anonymous.GetAsync($"{route}?area={prefix}&limit=100&page={page}&includeUnpublished=true");
            var result = await JsonAsync(response, HttpStatusCode.OK);
            Assert.AreEqual(JsonValueKind.Array, result.ValueKind);
            Assert.AreEqual(page < 3 ? "true" : "false", response.Headers.GetValues(ListPagination.HasMoreHeader).Single());
            Assert.AreEqual(page < 3 ? 100 : page == 3 ? 5 : 0, result.GetArrayLength());
            ids.AddRange(result.EnumerateArray().Select(item => item.GetProperty("id").GetInt32()));
        }
        Assert.AreEqual(205, ids.Distinct().Count());
        var own = await JsonAsync(await author.GetAsync($"{route}?area={prefix}&limit=200&page=2&includeUnpublished=true"), HttpStatusCode.OK);
        Assert.AreEqual(7, own.GetArrayLength());
        var foreign = await JsonAsync(await moderator.GetAsync($"{route}?area={prefix}&limit=200&page=2&includeUnpublished=true"), HttpStatusCode.OK);
        Assert.AreEqual(5, foreign.GetArrayLength());
        foreach (var page in new[] { "0", "-1", "10001", "invalid" })
            Assert.AreEqual(HttpStatusCode.BadRequest, (await anonymous.GetAsync($"{route}?page={page}")).StatusCode);
        if (type == "gallery")
        {
            Assert.IsTrue(own.EnumerateArray().All(album => album.GetProperty("canViewHistory").GetBoolean()));
            Assert.IsTrue(foreign.EnumerateArray().All(album => !album.GetProperty("canViewHistory").GetBoolean()));
            var editable = await JsonAsync(await author.GetAsync($"{route}?area={prefix}&includeUnpublished=true&editableOnly=true&limit=20"), HttpStatusCode.OK);
            Assert.AreEqual(1, editable.GetArrayLength());
            Assert.AreEqual("Draft", editable[0].GetProperty("editorialStatus").GetString());
            var noEditable = await JsonAsync(await moderator.GetAsync($"{route}?area={prefix}&includeUnpublished=true&editableOnly=true"), HttpStatusCode.OK);
            Assert.AreEqual(0, noEditable.GetArrayLength());
            var wrongYear = await JsonAsync(await anonymous.GetAsync($"{route}?area={prefix}&year=2026&limit=20"), HttpStatusCode.OK);
            Assert.AreEqual(0, wrongYear.GetArrayLength());
            foreach (var filter in new[] { "year=0", "year=10000", "tagId=-1", "limit=201" })
                Assert.AreEqual(HttpStatusCode.BadRequest, (await anonymous.GetAsync($"{route}?{filter}")).StatusCode);
        }
    }

    [TestMethod]
    public async Task ModerationQueue_PaginatesAcrossAllTypes_AndChecksCurrentAssignments()
    {
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        var prefix = "queue-" + Guid.NewGuid().ToString("N");
        var user = new IdentityUser { UserName = prefix + "@example.test", Email = prefix + "@example.test", EmailConfirmed = true };
        Assert.IsTrue((await users.CreateAsync(user, Password)).Succeeded);
        Assert.IsTrue((await users.AddToRoleAsync(user, RoleNames.Moderator)).Succeeded);
        var area = new Area { Name = prefix, Slug = prefix, IsActive = true };
        db.Areas.Add(area); await db.SaveChangesAsync();
        var assignment = new AreaModeratorAssignment { UserId = user.Id, AreaId = area.Id, IsActive = true, AssignedByUserId = UserIds[RoleNames.SuperUser] };
        db.AreaModeratorAssignments.Add(assignment);
        var timestamp = DateTime.UtcNow.AddDays(-1);
        for (var index = 0; index < 206; index++)
        {
            IEditorialContent content = (index % 4) switch
            {
                0 => new News { Title = prefix + index, Slug = prefix + index, Body = "Body", Excerpt = "Excerpt", AreaId = area.Id, CreatedAt = timestamp, CreatedByUserId = UserIds[RoleNames.Korisnik] },
                1 => new BlogPost { Title = prefix + index, Slug = prefix + index, Body = "Body", Excerpt = "Excerpt", AreaId = area.Id, CreatedAt = timestamp, CreatedByUserId = UserIds[RoleNames.Korisnik] },
                2 => new Announcement { Title = prefix + index, Slug = prefix + index, Body = "Body", Summary = "Summary", AreaId = area.Id, CreatedAt = timestamp, StartsAt = timestamp, CreatedByUserId = UserIds[RoleNames.Korisnik] },
                _ => new GalleryAlbum { Title = prefix + index, AreaId = area.Id, CreatedAt = timestamp, CreatedByUserId = UserIds[RoleNames.Korisnik] },
            };
            content.EditorialStatus = EditorialStatus.PendingReview;
            db.Add(content);
        }
        db.News.Add(new News { Title = "Own excluded", Slug = prefix + "-own", Body = "Body", Excerpt = "Excerpt", AreaId = area.Id, CreatedByUserId = user.Id, EditorialStatus = EditorialStatus.PendingReview });
        db.News.Add(new News { Title = "Foreign excluded", Slug = prefix + "-foreign", Body = "Body", Excerpt = "Excerpt", AreaId = _otherAreaId, CreatedByUserId = UserIds[RoleNames.Korisnik], EditorialStatus = EditorialStatus.PendingReview });
        await db.SaveChangesAsync();
        using var moderator = await LoginAsync(prefix);
        var keys = new List<string>();
        for (var page = 1; page <= 3; page++)
        {
            using var response = await moderator.GetAsync($"/api/moderation/queue?page={page}&limit=100");
            var items = await JsonAsync(response, HttpStatusCode.OK);
            Assert.AreEqual(page < 3 ? 100 : 6, items.GetArrayLength());
            Assert.AreEqual(page < 3 ? "true" : "false", response.Headers.GetValues(ListPagination.HasMoreHeader).Single());
            foreach (var item in items.EnumerateArray())
            {
                StringAssert.StartsWith(item.GetProperty("title").GetString(), prefix);
                keys.Add($"{item.GetProperty("contentType")}:{item.GetProperty("id")}");
            }
        }
        Assert.AreEqual(206, keys.Distinct().Count());
        CollectionAssert.AreEquivalent(new[] { "Announcement", "Blog", "Gallery", "News" }, keys.Select(key => key.Split(':')[0]).Distinct().ToArray());
        assignment.EndsAt = DateTime.UtcNow.AddMinutes(-1); await db.SaveChangesAsync();
        var expired = await JsonAsync(await moderator.GetAsync("/api/moderation/queue"), HttpStatusCode.OK);
        Assert.AreEqual(0, expired.GetArrayLength());
        assignment.EndsAt = null; assignment.IsActive = false; await db.SaveChangesAsync();
        var inactive = await JsonAsync(await moderator.GetAsync("/api/moderation/queue"), HttpStatusCode.OK);
        Assert.AreEqual(0, inactive.GetArrayLength());
        Assert.AreEqual(HttpStatusCode.BadRequest, (await moderator.GetAsync("/api/moderation/queue?page=0")).StatusCode);
        using var guest = await LoginAsync(RoleNames.Gost);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await guest.GetAsync("/api/moderation/queue?page=2")).StatusCode);
    }

    [TestMethod]
    public async Task Cors_AllowsOnlyConfiguredFrontend_AndExposesPaginationWithoutCookies()
    {
        using var client = Client();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/gallery/albums?limit=1");
        request.Headers.Add("Origin", "https://frontend.example.test");
        using var response = await client.SendAsync(request);
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.AreEqual("https://frontend.example.test", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        StringAssert.Contains(string.Join(",", response.Headers.GetValues("Access-Control-Expose-Headers")), ListPagination.HasMoreHeader);
        Assert.IsFalse(response.Headers.Contains("Access-Control-Allow-Credentials"));
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/updates/editorial");
        preflight.Headers.Add("Origin", "https://frontend.example.test");
        preflight.Headers.Add("Access-Control-Request-Method", "GET");
        preflight.Headers.Add("Access-Control-Request-Headers", "authorization");
        using var allowed = await client.SendAsync(preflight);
        Assert.AreEqual(HttpStatusCode.NoContent, allowed.StatusCode);
        StringAssert.Contains(string.Join(",", allowed.Headers.GetValues("Access-Control-Allow-Headers")), "authorization");
        using var forbidden = new HttpRequestMessage(HttpMethod.Get, "/api/gallery/albums");
        forbidden.Headers.Add("Origin", "https://untrusted.example.test");
        using var denied = await client.SendAsync(forbidden);
        Assert.IsFalse(denied.Headers.Contains("Access-Control-Allow-Origin"));
    }

    private static Dictionary<string, object?> Payload(string type, int area) => new()
    {
        ["title"] = type + Guid.NewGuid().ToString("N"), ["summary"] = "Summary", ["excerpt"] = "Excerpt", ["body"] = "Body",
        ["areaId"] = area, ["startsAt"] = DateTime.UtcNow.AddMinutes(-1), ["importance"] = "Important",
        ["origin"] = "PersonalTestimony", ["eventDate"] = "1999-06-12", ["photographer"] = "Test photographer",
        ["publishedAt"] = DateTime.UtcNow.AddMinutes(-1), // Contributor must not be able to publish via mass assignment.
    };

    private static HttpClient Client() => (_app ?? throw new InvalidOperationException()).CreateClient(new() { BaseAddress = new Uri("https://localhost") });
    private static async Task<HttpClient> LoginAsync(string role)
    {
        var client = Client();
        var result = await JsonAsync(await client.PostAsJsonAsync("/login", new { email = role + "@example.test", password = Password }), HttpStatusCode.OK);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", result.GetProperty("accessToken").GetString());
        return client;
    }
    private static async Task<JsonElement> DetailAsync(HttpClient client, string route, int id, string type)
    {
        var value = await JsonAsync(await client.GetAsync($"{route}/{id}?includeUnpublished=true"), HttpStatusCode.OK);
        return type == "gallery" ? value.GetProperty("album") : value;
    }
    private static async Task<string> VersionAsync(HttpClient client, string route, int id, string type) =>
        (await DetailAsync(client, route, id, type)).GetProperty("rowVersion").GetString()!;
    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        // Do not include response bodies: login results contain tokens.
        Assert.AreEqual(expected, response.StatusCode, $"Unexpected status for {response.RequestMessage?.RequestUri?.AbsolutePath}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private sealed class TestApplication : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("SeedAdminUser:Enabled", "false");
            builder.UseSetting("SeedAdminUser:Email", "");
            builder.UseSetting("AccountEmail:Enabled", "false");
            builder.UseSetting("AllowedHosts", "localhost");
            builder.UseSetting("Cors:AllowedOrigins:0", "https://frontend.example.test");
            builder.UseSetting("ConnectionStrings:DefaultConnection", TestConnectionString);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<VranjicContext>>();
                services.RemoveAll<IDbContextOptionsConfiguration<VranjicContext>>();
                services.AddDbContext<VranjicContext>(options => options.UseSqlServer(TestConnectionString));
                services.AddDataProtection().UseEphemeralDataProtectionProvider();
            });
        }
    }
}
