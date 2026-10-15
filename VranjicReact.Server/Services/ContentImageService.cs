using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public record ValidatedContentImage(string ContentType, byte[] Data);

public sealed class ContentImageService(VranjicContext db)
{
    public static string? Validate(InlineImageUpload? upload, out ValidatedContentImage? image)
    {
        image = null;
        if (upload is null) return null;
        if (string.IsNullOrWhiteSpace(upload.Base64Data)) return "Odaberite fotografiju.";
        if (upload.Base64Data.Length > (GalleryMediaValidation.MaximumBytes + 2) / 3 * 4) return "Fotografija smije imati najviše 20 MiB.";
        byte[] data;
        try { data = Convert.FromBase64String(upload.Base64Data); }
        catch (FormatException) { return "Podaci fotografije nisu valjani."; }
        var contentType = upload.ContentType?.ToLowerInvariant();
        if (!GalleryMediaValidation.IsSupported(GalleryMediaType.Image, contentType, data))
            return "Podržane su fotografije JPG, PNG, GIF i WebP do 20 MiB. Sadržaj datoteke mora odgovarati formatu.";
        image = new(contentType!, data);
        return null;
    }

    public static string ImageUrl(string type, int contentId, int imageId) => $"/api/content-images/{type}/{contentId}/{imageId}";

    public static bool IsAttached(IEditorialContent content, string type, int imageId) => content switch
    {
        BlogPost post when type == "blog" => post.HeroImageUrl == ImageUrl(type, post.Id, imageId),
        News news when type == "news" => news.HeroImageUrl == ImageUrl(type, news.Id, imageId),
        _ => false,
    };

    public Task<bool> IsReferencedAsync(GalleryImage image, CancellationToken ct) => ImageReferences(image).AnyAsync(ct);

    internal IQueryable<int> ImageReferences(GalleryImage image)
    {
        var imageId = image.Id;
        var ownerId = image.Album?.CreatedByUserId;
        var suffix = $"/{imageId}";
        // Match only the exact cover URL and its owner; a forged URL must not block another author's deletion.
        return db.News.Where(news => news.GalleryImageId == imageId || (news.CreatedByUserId == ownerId
                && news.HeroImageUrl == "/api/content-images/news/" + news.Id.ToString() + suffix)).Select(news => news.Id)
            .Concat(db.BlogPosts.Where(post => post.CreatedByUserId == ownerId
                && post.HeroImageUrl == "/api/content-images/blog/" + post.Id.ToString() + suffix).Select(post => post.Id));
    }

    // Save the content, its automatically prepared album and cover in one transaction.
    // A failed save/concurrency check leaves neither an orphan album nor a partial post.
    public async Task SaveAsync(IEditorialContent content, string title, ValidatedContentImage? image,
        IEnumerable<Tag> tags, string? actorId, CancellationToken ct)
    {
        if (image is null) { await db.SaveChangesAsync(ct); return; }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var albumTitle = $"Fotografije: {title.Trim()}";
        var album = content as GalleryAlbum ?? new GalleryAlbum
        {
            Title = albumTitle[..Math.Min(200, albumTitle.Length)],
            CreatedByUserId = content.CreatedByUserId,
            AreaId = content.AreaId,
            EditorialStatus = EditorialStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            Description = "Naslovna fotografija sadržaja. Album se objavljuje zasebno.",
        };
        if (content is not GalleryAlbum)
            foreach (var tag in tags) album.GalleryAlbumTags.Add(new GalleryAlbumTag { TagId = tag.Id, Tag = tag, GalleryAlbum = album });
        var media = new GalleryImage
        {
            Title = title.Trim()[..Math.Min(200, title.Trim().Length)],
            MediaType = GalleryMediaType.Image, ContentType = image.ContentType,
            Data = image.Data, Size = image.Data.Length,
            Album = album, UploadedByUserId = actorId, UploadedAt = DateTime.UtcNow,
        };
        db.GalleryImages.Add(media);
        await db.SaveChangesAsync(ct);
        switch (content)
        {
            case BlogPost post: post.HeroImageUrl = ImageUrl("blog", post.Id, media.Id); break;
            case News news: news.HeroImageUrl = ImageUrl("news", news.Id, media.Id); break;
        }
        if (content is not GalleryAlbum) await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
