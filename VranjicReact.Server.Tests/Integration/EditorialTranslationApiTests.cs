using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Integration;

public sealed partial class EditorialApiTests
{
    [TestMethod]
    [DataRow("news")]
    [DataRow("blog")]
    [DataRow("announcement")]
    [DataRow("gallery")]
    [DataRow("image")]
    [DataRow("area")]
    [DataRow("tag")]
    public async Task Translations_AllContentTypes_SaveEditDeleteAndInvalidate(string kind)
    {
        using var admin = await LoginAsync(RoleNames.Administrator);
        var (route, payload, source, _) = await TranslationPayloadAsync(admin, kind);
        payload["publishedAt"] = null; // Keep this lifecycle test in draft; existing audit restrictions still apply.
        var english = source.ToDictionary(pair => pair.Key, pair => (string?)("EN " + pair.Key));
        var german = source.ToDictionary(pair => pair.Key, pair => (string?)("DE " + pair.Key));
        payload["translations"] = new[] { new TranslationEdit("en", english, source), new TranslationEdit("de", german, source), new TranslationEdit("fr", german, source) };
        var created = await JsonAsync(await admin.PostAsJsonAsync(route, payload), HttpStatusCode.Created);
        var id = created.GetProperty("id").GetInt32();
        var detailRoute = kind is "area" or "tag" ? $"{route}/admin/{id}" : $"{route}/{id}?includeUnpublished=true";
        var detail = created;
        Assert.AreEqual(3, detail.GetProperty("translations").GetArrayLength());
        var en = Translation(detail, "en");
        Assert.IsFalse(en.GetProperty("isStale").GetBoolean());
        var primary = kind is "area" or "tag" ? "name" : "title";
        Assert.AreEqual(source[primary], detail.GetProperty(primary).GetString());

        // A reviewed manual edit changes only EN. HR and DE remain intact.
        english[primary] = "Manual English correction";
        payload["rowVersion"] = detail.TryGetProperty("rowVersion", out var version) ? version.GetString() : null;
        payload["translations"] = new[] { new TranslationEdit("en", english, source, en.GetProperty("version").GetGuid()) };
        using (var response = await admin.PutAsJsonAsync($"{route}/{id}", payload))
            Assert.IsTrue(response.IsSuccessStatusCode);
        detail = TranslationDetail(await JsonAsync(await admin.GetAsync(detailRoute), HttpStatusCode.OK), kind);
        Assert.AreEqual(source[primary], detail.GetProperty(primary).GetString());
        Assert.AreEqual("Manual English correction", Translation(detail, "en").GetProperty("fields").GetProperty(primary).GetString());
        Assert.AreEqual("DE " + primary, Translation(detail, "de").GetProperty("fields").GetProperty(primary).GetString());

        // Deleting EN is an explicit edit, never a delete of the HR owner or other language.
        payload["rowVersion"] = detail.TryGetProperty("rowVersion", out version) ? version.GetString() : null;
        payload["translations"] = new[] { new TranslationEdit("en", Version: Translation(detail, "en").GetProperty("version").GetGuid(), Delete: true) };
        using (var response = await admin.PutAsJsonAsync($"{route}/{id}", payload))
            Assert.IsTrue(response.IsSuccessStatusCode);
        detail = TranslationDetail(await JsonAsync(await admin.GetAsync(detailRoute), HttpStatusCode.OK), kind);
        Assert.AreEqual(2, detail.GetProperty("translations").GetArrayLength());
        Assert.IsFalse(detail.GetProperty("translations").EnumerateArray().Any(t => t.GetProperty("language").GetString() == "en"));
        Assert.AreEqual(source[primary], detail.GetProperty(primary).GetString());

        // Legacy clients omit translations: preserve them, and invalidate on HR text changes.
        payload.Remove("translations");
        payload["rowVersion"] = detail.TryGetProperty("rowVersion", out version) ? version.GetString() : null;
        payload[primary] = "Changed Croatian " + Guid.NewGuid().ToString("N");
        using (var response = await admin.PutAsJsonAsync($"{route}/{id}", payload))
            Assert.IsTrue(response.IsSuccessStatusCode);
        detail = TranslationDetail(await JsonAsync(await admin.GetAsync(detailRoute), HttpStatusCode.OK), kind);
        Assert.IsTrue(Translation(detail, "de").GetProperty("isStale").GetBoolean());
        Assert.AreEqual("DE " + primary, Translation(detail, "de").GetProperty("fields").GetProperty(primary).GetString());

        // ExecuteDelete deliberately bypasses EF's tracked cascade: assert the database FK cascade itself.
        using var scope = (_app ?? throw new InvalidOperationException()).Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        FormattableString countSql = kind switch
        {
            "news" => $"SELECT COUNT(*) AS [Value] FROM [NewsTranslations] WHERE [ContentId] = {id}",
            "blog" => $"SELECT COUNT(*) AS [Value] FROM [BlogPostTranslations] WHERE [ContentId] = {id}",
            "announcement" => $"SELECT COUNT(*) AS [Value] FROM [AnnouncementTranslations] WHERE [ContentId] = {id}",
            "gallery" => $"SELECT COUNT(*) AS [Value] FROM [GalleryAlbumTranslations] WHERE [ContentId] = {id}",
            "image" => $"SELECT COUNT(*) AS [Value] FROM [GalleryImageTranslations] WHERE [ContentId] = {id}",
            "area" => $"SELECT COUNT(*) AS [Value] FROM [AreaTranslations] WHERE [ContentId] = {id}",
            "tag" => $"SELECT COUNT(*) AS [Value] FROM [TagTranslations] WHERE [ContentId] = {id}",
            _ => throw new ArgumentException("Unknown kind"),
        };
        Assert.AreEqual(2, await db.Database.SqlQuery<int>(countSql).SingleAsync());
        switch (kind)
        {
            case "news": await db.News.Where(n => n.Id == id).ExecuteDeleteAsync(); break;
            case "blog": await db.BlogPosts.Where(n => n.Id == id).ExecuteDeleteAsync(); break;
            case "announcement": await db.Announcements.Where(n => n.Id == id).ExecuteDeleteAsync(); break;
            case "gallery": await db.GalleryAlbums.Where(n => n.Id == id).ExecuteDeleteAsync(); break;
            case "image": await db.GalleryImages.Where(n => n.Id == id).ExecuteDeleteAsync(); break;
            case "area": await db.Areas.Where(n => n.Id == id).ExecuteDeleteAsync(); break;
            case "tag": await db.Tags.Where(n => n.Id == id).ExecuteDeleteAsync(); break;
        }
        Assert.AreEqual(0, await db.Database.SqlQuery<int>(countSql).SingleAsync());
    }

    [TestMethod]
    public async Task Translations_PublicReadsRespectPublication_AndSummariesDoNotLeakBody()
    {
        using var admin = await LoginAsync(RoleNames.Administrator);
        using var anonymous = Client();
        var (route, payload, source, _) = await TranslationPayloadAsync(admin, "news");
        payload["translations"] = new[] { new TranslationEdit("en", new() { ["title"] = "English headline", ["excerpt"] = "English excerpt", ["body"] = "Full English article" }, source) };
        var created = await JsonAsync(await admin.PostAsJsonAsync(route, payload), HttpStatusCode.Created);
        var id = created.GetProperty("id").GetInt32();
        var detail = await JsonAsync(await anonymous.GetAsync($"{route}/{id}"), HttpStatusCode.OK);
        Assert.AreEqual("Full English article", Translation(detail, "en").GetProperty("fields").GetProperty("body").GetString());
        var list = await JsonAsync(await anonymous.GetAsync(route + "?limit=200"), HttpStatusCode.OK);
        var summary = list.EnumerateArray().Single(n => n.GetProperty("id").GetInt32() == id);
        Assert.IsFalse(Translation(summary, "en").GetProperty("fields").TryGetProperty("body", out _));
        var updates = await JsonAsync(await anonymous.GetAsync("/api/updates?kind=News&pageSize=100"), HttpStatusCode.OK);
        var update = updates.GetProperty("items").EnumerateArray().Single(n => n.GetProperty("id").GetInt32() == id);
        Assert.AreEqual("English excerpt", Translation(update, "en").GetProperty("fields").GetProperty("summary").GetString());
        Assert.IsFalse(Translation(update, "en").GetProperty("fields").TryGetProperty("body", out _));

        payload.Remove("translations");
        payload["title"] = "New Croatian title";
        payload["rowVersion"] = created.GetProperty("rowVersion").GetString();
        using (var response = await admin.PutAsJsonAsync($"{route}/{id}", payload)) Assert.IsTrue(response.IsSuccessStatusCode);
        Assert.AreEqual(HttpStatusCode.NotFound, (await anonymous.GetAsync($"{route}/{id}")).StatusCode);
        detail = await JsonAsync(await admin.GetAsync($"{route}/{id}?includeUnpublished=true"), HttpStatusCode.OK);
        await admin.PostAsJsonAsync($"/api/moderation/news/{id}/publish", new { rowVersion = detail.GetProperty("rowVersion").GetString() });
        detail = await JsonAsync(await anonymous.GetAsync($"{route}/{id}"), HttpStatusCode.OK);
        Assert.AreEqual(0, detail.GetProperty("translations").GetArrayLength());
    }

    [TestMethod]
    public async Task Translations_RejectInvalidEditsAndConcurrentVersions_Atomically()
    {
        using var admin = await LoginAsync(RoleNames.Administrator);
        var (route, payload, source, _) = await TranslationPayloadAsync(admin, "area");
        payload["translations"] = new[] { new TranslationEdit("en", new() { ["name"] = "English" }, source) };
        var area = await JsonAsync(await admin.PostAsJsonAsync(route, payload), HttpStatusCode.Created);
        int id = area.GetProperty("id").GetInt32();
        var originalName = area.GetProperty("name").GetString();
        var version = Translation(area, "en").GetProperty("version").GetGuid();
        payload["name"] = "Must not be persisted";
        foreach (var badEdit in new[]
        {
            new TranslationEdit("hr", new() { ["name"] = "Wrong" }, source),
            new TranslationEdit("en", new() { ["name"] = new string('x', 129) }, source, version),
            new TranslationEdit("en", new() { ["slug"] = "forged" }, source, version),
            new TranslationEdit("en", new() { ["name"] = "Text" }, new(), version),
        })
        {
            payload["translations"] = new[] { badEdit };
            Assert.AreEqual(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"{route}/{id}", payload)).StatusCode);
        }
        payload["translations"] = new[] { new TranslationEdit("en", Version: Guid.NewGuid(), Delete: true) };
        Assert.AreEqual(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"{route}/{id}", payload)).StatusCode);
        area = await JsonAsync(await admin.GetAsync($"{route}/admin/{id}"), HttpStatusCode.OK);
        Assert.AreEqual(originalName, area.GetProperty("name").GetString());
        Assert.AreEqual(version, Translation(area, "en").GetProperty("version").GetGuid());
        using var author = await LoginAsync(RoleNames.Korisnik);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await author.PutAsJsonAsync($"{route}/{id}", payload)).StatusCode);
    }

    [TestMethod]
    public async Task Translations_CannotBeChangedByAnotherAuthorOrAreaModerator()
    {
        using var author = await LoginAsync(RoleNames.Korisnik);
        using var moderator = await LoginAsync(RoleNames.Moderator);
        using var guest = await LoginAsync(RoleNames.Gost);
        var (route, payload, source, _) = await TranslationPayloadAsync(author, "blog");
        payload["translations"] = new[] { new TranslationEdit("en", new() { ["title"] = "English" }, source) };
        var post = await JsonAsync(await author.PostAsJsonAsync(route, payload), HttpStatusCode.Created);
        var id = post.GetProperty("id").GetInt32();
        payload["rowVersion"] = post.GetProperty("rowVersion").GetString();
        payload["translations"] = new[] { new TranslationEdit("en", Version: Translation(post, "en").GetProperty("version").GetGuid(), Delete: true) };
        Assert.AreEqual(HttpStatusCode.Forbidden, (await moderator.PutAsJsonAsync($"{route}/{id}", payload)).StatusCode);
        Assert.AreEqual(HttpStatusCode.Forbidden, (await guest.PutAsJsonAsync($"{route}/{id}", payload)).StatusCode);
        var unchanged = await JsonAsync(await author.GetAsync($"{route}/{id}?includeUnpublished=true"), HttpStatusCode.OK);
        Assert.AreEqual(1, unchanged.GetProperty("translations").GetArrayLength());
    }

    private static JsonElement Translation(JsonElement detail, string language) =>
        detail.GetProperty("translations").EnumerateArray().Single(t => t.GetProperty("language").GetString() == language);

    private static JsonElement TranslationDetail(JsonElement value, string kind) => kind == "gallery" ? value.GetProperty("album") : value;

    private static async Task<(string Route, Dictionary<string, object?> Payload, Dictionary<string, string?> Source, Type Type)> TranslationPayloadAsync(HttpClient client, string kind)
    {
        var payload = Payload(kind, _areaId);
        payload["description"] = "Hrvatski opis";
        payload["actionLabel"] = "Više";
        payload["actionUrl"] = "/vise";
        payload["shortDescription"] = "Kratki opis";
        payload["name"] = "Naziv " + Guid.NewGuid().ToString("N");
        payload["isActive"] = true;
        string route;
        Type type;
        switch (kind)
        {
            case "news": route = "/api/news"; type = typeof(News); break;
            case "blog": route = "/api/blog"; type = typeof(BlogPost); break;
            case "announcement": route = "/api/announcements"; type = typeof(Announcement); break;
            case "gallery": route = "/api/gallery/albums"; type = typeof(GalleryAlbum); break;
            case "area": route = "/api/areas"; type = typeof(Area); break;
            case "tag": route = "/api/tags"; type = typeof(Tag); break;
            case "image":
                route = "/api/gallery"; type = typeof(GalleryImage);
                var album = await JsonAsync(await client.PostAsJsonAsync("/api/gallery/albums", Payload("gallery", _areaId)), HttpStatusCode.Created);
                payload["albumId"] = album.GetProperty("id").GetInt32();
                payload["mediaType"] = "Image"; payload["contentType"] = "image/png"; payload["fileName"] = "test.png";
                payload["base64Data"] = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
                break;
            default: throw new ArgumentException("Unknown kind");
        }
        var source = ContentTranslationSchema.Fields(type).Keys.ToDictionary(key => key, key => payload.GetValueOrDefault(key)?.ToString());
        return (route, payload, source, type);
    }
}
