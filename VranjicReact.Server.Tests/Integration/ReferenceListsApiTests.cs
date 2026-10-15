using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Integration;

public sealed partial class EditorialApiTests
{
    [TestMethod]
    public async Task Assignments_PaginateAfterFilters_AndDistinguishExpiryFromDeactivation()
    {
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var prefix = "assign-" + Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;
        for (var index = 0; index < 207; index++)
        {
            var area = new Area { Name = prefix + index.ToString("D3"), Slug = prefix + index, IsActive = true };
            db.AreaModeratorAssignments.Add(new AreaModeratorAssignment { Area = area, UserId = UserIds[RoleNames.Moderator],
                AssignedAt = now, IsActive = index != 206, EndsAt = index >= 205 ? now.AddDays(-1) : null });
        }
        await db.SaveChangesAsync();
        using var admin = await LoginAsync(RoleNames.Administrator);
        var ids = new List<int>();
        for (var page = 1; page <= 4; page++)
        {
            using var response = await admin.GetAsync($"/api/moderator-assignments?search={prefix}&status=active&limit=100&page={page}");
            var rows = await JsonAsync(response, HttpStatusCode.OK);
            Assert.AreEqual(page < 3 ? 100 : page == 3 ? 5 : 0, rows.GetArrayLength());
            Assert.AreEqual(page < 3 ? "true" : "false", response.Headers.GetValues(ListPagination.HasMoreHeader).Single());
            foreach (var row in rows.EnumerateArray())
            {
                Assert.AreEqual("Active", row.GetProperty("status").GetString());
                Assert.AreEqual("Moderator@example.test", row.GetProperty("userEmail").GetString());
                ids.Add(row.GetProperty("id").GetInt32());
            }
        }
        Assert.AreEqual(205, ids.Distinct().Count());
        foreach (var status in new[] { "expired", "inactive" })
        {
            var rows = await JsonAsync(await admin.GetAsync($"/api/moderator-assignments?search={prefix}&status={status}"), HttpStatusCode.OK);
            Assert.AreEqual(1, rows.GetArrayLength());
            Assert.AreEqual(status, rows[0].GetProperty("status").GetString()!.ToLowerInvariant());
            var areaId = rows[0].GetProperty("area").GetProperty("id").GetInt32();
            var areaRows = await JsonAsync(await admin.GetAsync($"/api/moderator-assignments?areaId={areaId}&search=Moderator%40example.test"), HttpStatusCode.OK);
            Assert.AreEqual(1, areaRows.GetArrayLength());
        }
        foreach (var filter in new[] { "status=invalid", "areaId=0", "page=0", "page=10001", "limit=201", "search=" + new string('x', 201) })
            Assert.AreEqual(HttpStatusCode.BadRequest, (await admin.GetAsync("/api/moderator-assignments?" + filter)).StatusCode);
    }

    [TestMethod]
    public async Task ReferenceLookups_FindOlderImagesAndNews_WithoutDisclosingPrivateContent()
    {
        using var scope = _app!.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VranjicContext>();
        var prefix = "reference-" + Guid.NewGuid().ToString("N");
        var timestamp = DateTime.UtcNow.AddDays(-1);
        var album = new GalleryAlbum { Title = prefix, EditorialStatus = EditorialStatus.Published, PublishedAt = timestamp };
        var hiddenAlbum = new GalleryAlbum { Title = prefix + "-hidden", EditorialStatus = EditorialStatus.Draft };
        db.GalleryAlbums.AddRange(album, hiddenAlbum);
        await db.SaveChangesAsync();
        for (var index = 0; index < 207; index++)
        {
            db.GalleryImages.Add(new GalleryImage { Title = prefix + index, AlbumId = index == 206 ? hiddenAlbum.Id : album.Id,
                MediaType = index == 205 ? GalleryMediaType.Video : GalleryMediaType.Image, UploadedAt = timestamp, Data = [1, 2, 3] });
            db.News.Add(new News { Title = prefix + index, Slug = prefix + index, Excerpt = "Excerpt", Body = "Body", CreatedAt = timestamp,
                EditorialStatus = index == 206 ? EditorialStatus.Draft : EditorialStatus.Published, PublishedAt = timestamp,
                GalleryAlbumId = index == 205 ? hiddenAlbum.Id : index == 206 ? album.Id : null });
        }
        await db.SaveChangesAsync();
        using var anonymous = Client();
        foreach (var route in new[] { $"/api/gallery?imagesOnly=true&albumId={album.Id}", "/api/news?unlinkedOnly=true&includeUnpublished=true" })
        {
            var ids = new List<int>();
            for (var page = 1; page <= 3; page++)
            {
                using var response = await anonymous.GetAsync($"{route}&search={prefix}&limit=100&page={page}");
                var rows = await JsonAsync(response, HttpStatusCode.OK);
                Assert.AreEqual(page < 3 ? 100 : 5, rows.GetArrayLength());
                Assert.AreEqual(page < 3 ? "true" : "false", response.Headers.GetValues(ListPagination.HasMoreHeader).Single());
                foreach (var row in rows.EnumerateArray())
                {
                    ids.Add(row.GetProperty("id").GetInt32());
                    Assert.IsFalse(row.TryGetProperty("data", out _));
                    Assert.IsFalse(row.TryGetProperty("base64Data", out _));
                }
            }
            Assert.AreEqual(205, ids.Distinct().Count());
        }
        var list = await JsonAsync(await anonymous.GetAsync($"/api/gallery/albums?search={prefix}"), HttpStatusCode.OK);
        Assert.AreEqual(1, list.GetArrayLength());
        Assert.IsTrue(!list[0].TryGetProperty("relatedNewsId", out var related) || related.ValueKind == System.Text.Json.JsonValueKind.Null);
        var detail = await JsonAsync(await anonymous.GetAsync($"/api/gallery/albums/{album.Id}"), HttpStatusCode.OK);
        var detailAlbum = detail.GetProperty("album");
        Assert.IsTrue(!detailAlbum.TryGetProperty("relatedNewsId", out related) || related.ValueKind == System.Text.Json.JsonValueKind.Null);
        using var admin = await LoginAsync(RoleNames.Administrator);
        var editorial = await JsonAsync(await admin.GetAsync($"/api/gallery/albums/{album.Id}"), HttpStatusCode.OK);
        Assert.IsTrue(editorial.GetProperty("album").GetProperty("relatedNewsId").GetInt32() > 0);
        Assert.AreEqual(0, (await JsonAsync(await anonymous.GetAsync($"/api/gallery?albumId={hiddenAlbum.Id}"), HttpStatusCode.OK)).GetArrayLength());
        foreach (var filter in new[] { "page=0", "limit=201", "albumId=0", "imagesOnly=invalid", "search=" + new string('x', 201) })
            Assert.AreEqual(HttpStatusCode.BadRequest, (await anonymous.GetAsync("/api/gallery?" + filter)).StatusCode);
        foreach (var route in new[] { "/api/news", "/api/gallery/albums" })
            Assert.AreEqual(HttpStatusCode.BadRequest, (await anonymous.GetAsync(route + "?search=" + new string('x', 201))).StatusCode);
    }
}
