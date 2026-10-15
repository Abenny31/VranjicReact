using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Controllers;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class ContentImageServiceTests
{
    [TestMethod]
    public void OptionalUploadAndValidPng_AreAccepted()
    {
        Assert.IsNull(ContentImageService.Validate(null, out var empty));
        Assert.IsNull(empty);
        byte[] png = [137, 80, 78, 71, 13, 10, 26, 10];
        Assert.IsNull(ContentImageService.Validate(new("image/png", Convert.ToBase64String(png)), out var image));
        Assert.IsNotNull(image);
        CollectionAssert.AreEqual(png, image.Data);
    }

    [TestMethod]
    [DataRow("image/png", "not base64!")]
    [DataRow("image/png", "PGh0bWw+")]
    [DataRow("image/svg+xml", "PHN2Zy8+")]
    [DataRow("video/mp4", "AAAAHGZ0eXBpc29t")]
    [DataRow("image/png", "")]
    public void InvalidOrNonImageUploads_AreRejected(string mime, string base64)
    {
        Assert.IsNotNull(ContentImageService.Validate(new(mime, base64), out var image));
        Assert.IsNull(image);
    }

    [TestMethod]
    public void OversizedUpload_IsRejectedBeforeDecoding()
    {
        var encoded = new string('A', (GalleryMediaValidation.MaximumBytes + 2) / 3 * 4 + 4);
        Assert.IsNotNull(ContentImageService.Validate(new("image/png", encoded), out var image));
        Assert.IsNull(image);
    }

    [TestMethod]
    public void ImageMustBeTheCurrentCoverOfTheExactContent()
    {
        var story = new BlogPost { Id = 10, HeroImageUrl = ContentImageService.ImageUrl("blog", 10, 7) };
        Assert.IsTrue(ContentImageService.IsAttached(story, "blog", 7));
        Assert.IsFalse(ContentImageService.IsAttached(story, "blog", 8));
        Assert.IsFalse(ContentImageService.IsAttached(story, "news", 7));
        story.Id = 11;
        Assert.IsFalse(ContentImageService.IsAttached(story, "blog", 7));
    }

    [TestMethod]
    public async Task DraftCover_IsNotAvailableToGuestsOrOtherContributors()
    {
        // FindAsync resolves the tracked entity. These early denials never connect to SQL.
        await using var db = Context();
        var story = new BlogPost { Id = 10, CreatedByUserId = "owner", EditorialStatus = EditorialStatus.Draft,
            HeroImageUrl = ContentImageService.ImageUrl("blog", 10, 7) };
        db.Attach(story);
        var workflow = new EditorialWorkflowService(db, new AreaModerationService(db));
        foreach (var user in new[] { new ClaimsPrincipal(new ClaimsIdentity()), User("other", RoleNames.Korisnik) })
        {
            var controller = new ContentImagesController(db, workflow) {
                ControllerContext = new() { HttpContext = new DefaultHttpContext { User = user } } };
            Assert.IsInstanceOfType<NotFoundResult>(await controller.Get("blog", 10, 7, default));
        }
        Assert.IsTrue(await workflow.CanPreviewAsync(User("owner", RoleNames.Korisnik), story, default));
        Assert.IsTrue(await workflow.CanPreviewAsync(User("reviewer", RoleNames.Verifier), story, default));
        Assert.IsFalse(await workflow.CanPreviewAsync(User("reviewer", RoleNames.Verifier),
            new News { CreatedByUserId = "owner" }, default));
    }

    private static ClaimsPrincipal User(string id, string role) => new(new ClaimsIdentity(
        [new Claim(ClaimTypes.NameIdentifier, id), new Claim(ClaimTypes.Role, role)], "test"));

    [TestMethod]
    public void DeletionGuard_TranslatesExactOwnedReferencesWithoutLoadingImages()
    {
        using var db = Context();
        var query = new ContentImageService(db).ImageReferences(new GalleryImage {
            Id = 7, Album = new GalleryAlbum { CreatedByUserId = "owner" } }).ToQueryString();
        StringAssert.Contains(query, "[CreatedByUserId] = @");
        StringAssert.Contains(query, "[GalleryImageId] = @");
        StringAssert.Contains(query, "/api/content-images/blog/");
        StringAssert.Contains(query, "/api/content-images/news/");
        Assert.IsFalse(query.Contains("LIKE") || query.Contains("[Data]"));
    }

    internal static VranjicContext Context() => new(new DbContextOptionsBuilder<VranjicContext>()
        .UseSqlServer("Server=unused;Database=NoConnection;Integrated Security=true").Options);
}
