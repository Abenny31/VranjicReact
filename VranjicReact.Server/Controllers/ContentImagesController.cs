using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/content-images")]
public sealed class ContentImagesController(VranjicContext db, EditorialWorkflowService workflow) : ControllerBase
{
    [HttpGet("{type}/{contentId:int}/{imageId:int}")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Get(string type, int contentId, int imageId, CancellationToken ct)
    {
        if (type is not "blog" and not "news") return NotFound();
        var content = await workflow.FindAsync(type, contentId, ct);
        if (content is null || !ContentImageService.IsAttached(content, type, imageId)) return NotFound();
        var published = content.EditorialStatus == EditorialStatus.Published && content.PublishedAt <= DateTime.UtcNow;
        if (!published && !await workflow.CanPreviewAsync(User, content, ct)) return NotFound();
        // Knowing an image ID never grants access to a different author's private album.
        var image = await db.GalleryImages.AsNoTracking().Where(item => item.Id == imageId
                && item.MediaType == GalleryMediaType.Image && item.Album != null
                && item.Album.CreatedByUserId == content.CreatedByUserId)
            .Select(item => new { item.Data, item.ContentType }).FirstOrDefaultAsync(ct);
        if (image is null || !GalleryMediaValidation.IsSupported(GalleryMediaType.Image, image.ContentType, image.Data)) return NotFound();
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(image.Data, image.ContentType!);
    }
}
