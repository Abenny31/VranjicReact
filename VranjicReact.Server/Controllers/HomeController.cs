using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HomeController : ControllerBase
    {
        private readonly VranjicContext _db;
        private readonly IOptionsSnapshot<PublicDisplayOptions> _display;

        public HomeController(VranjicContext db, IOptionsSnapshot<PublicDisplayOptions> display)
        {
            _db = db;
            _display = display;
        }

        [HttpGet]
        public async Task<ActionResult<HomeResponse>> Get(CancellationToken ct)
        {
            var utcNow = DateTime.UtcNow;
            var newsProjections = await _db.News.AsNoTracking()
                .Where(n => n.PublishedAt.HasValue && n.PublishedAt <= utcNow)
                .OrderByDescending(n => n.PublishedAt ?? n.CreatedAt)
                .Take(5)
                .Select(n => new
                {
                    n.Id,
                    n.Slug,
                    n.Title,
                    n.Excerpt,
                    n.PublishedAt,
                    n.IsFeatured,
                    n.HeroImageUrl,
                    n.GalleryAlbumId,
                    n.GalleryImageId,
                    n.TimePerspective,
                    Area = n.Area == null
                        ? null
                        : new AreaReferenceDto(n.Area.Id, n.Area.Name, n.Area.Slug),
                })
                .ToListAsync(ct);

            var newsAlbumIds = newsProjections
                .Select(n => n.GalleryAlbumId)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            var newsCoverLookup = new Dictionary<int, int>();

            if (newsAlbumIds.Count > 0)
            {
                var covers = await _db.GalleryImages
                    .AsNoTracking()
                    .Where(image => newsAlbumIds.Contains(image.AlbumId))
                    .GroupBy(image => image.AlbumId)
                    .Select(group => group
                        .OrderByDescending(image => image.IsFeatured)
                        .ThenByDescending(image => image.UploadedAt)
                        .FirstOrDefault())
                    .ToListAsync(ct);

                newsCoverLookup = covers
                    .Where(image => image is not null)
                    .Cast<GalleryImage>()
                    .ToDictionary(image => image.AlbumId, image => image.Id);
            }

            var latestNews = newsProjections
                .Select(item =>
                {
                    var hero = string.IsNullOrWhiteSpace(item.HeroImageUrl)
                        ? (item.GalleryImageId is int imageId
                            ? $"/api/gallery/{imageId}/media"
                            : (item.GalleryAlbumId is int albumId && newsCoverLookup.TryGetValue(albumId, out var coverId)
                                ? $"/api/gallery/{coverId}/media"
                                : null))
                        : item.HeroImageUrl;

                    return new NewsSummaryDto(
                        item.Id,
                        item.Slug,
                        item.Title,
                        item.Excerpt,
                        item.PublishedAt,
                        item.IsFeatured,
                        hero,
                        item.GalleryAlbumId,
                        item.GalleryImageId)
                    {
                        Area = item.Area,
                        TimePerspective = item.TimePerspective?.ToString(),
                    };
                })
                .ToList();

            var albumSummaries = await _db.GalleryAlbums.AsNoTracking()
                .Where(a => a.EditorialStatus == EditorialStatus.Published && a.PublishedAt <= utcNow)
                .OrderByDescending(a => a.UpdatedAt ?? a.CreatedAt)
                .ThenBy(a => a.Title)
                .Take(6)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    a.Description,
                    a.CreatedAt,
                    a.EventDate,
                    a.Photographer,
                    a.TimePerspective,
                    Area = a.Area == null
                        ? null
                        : new AreaReferenceDto(a.Area.Id, a.Area.Name, a.Area.Slug),
                    Tags = a.GalleryAlbumTags
                        .OrderBy(link => link.Tag.Name)
                        .Select(link => new TagDto(link.Tag.Id, link.Tag.Name, link.Tag.Slug, link.Tag.IsActive))
                        .ToList(),
                    ImageCount = _db.GalleryImages.Count(image => image.AlbumId == a.Id),
                    Cover = _db.GalleryImages
                        .Where(image => image.AlbumId == a.Id)
                        .OrderByDescending(image => image.IsFeatured)
                        .ThenByDescending(image => image.UploadedAt)
                        .FirstOrDefault(),
                    RelatedNews = _db.News
                        .Where(n => n.GalleryAlbumId == a.Id && n.PublishedAt <= utcNow)
                        .Select(n => new
                        {
                            n.Id,
                            n.Title,
                            n.Slug,
                        })
                        .FirstOrDefault(),
                })
                .ToListAsync(ct);

            var galleryHighlights = albumSummaries
                .Select(a => new GalleryAlbumSummaryDto(
                    a.Id,
                    a.Title,
                    a.Description,
                    a.ImageCount,
                    a.Cover is null
                        ? null
                        : new GalleryItemDto(
                            a.Cover.Id,
                            a.Cover.AlbumId,
                            a.Cover.Title,
                            a.Cover.Description,
                            a.Cover.MediaType.ToString(),
                            a.Cover.ContentType,
                            a.Cover.FileName,
                            a.Cover.Size,
                            a.Cover.IsFeatured,
                            a.Cover.UploadedAt,
                            false,
                            false),
                    a.RelatedNews?.Id,
                    a.RelatedNews?.Title,
                    a.RelatedNews?.Slug)
                {
                    CreatedAt = a.CreatedAt,
                    EventDate = a.EventDate,
                    Photographer = a.Photographer,
                    Area = a.Area,
                    TimePerspective = a.TimePerspective?.ToString(),
                    Tags = a.Tags,
                })
                .ToList();

            var areas = await _db.Areas
                .AsNoTracking()
                .Where(area => area.IsActive)
                .OrderBy(area => area.SortOrder)
                .ThenBy(area => area.Name)
                .Take(_display.Value.InitialAreaCount)
                .Select(area => new AreaDto(
                    area.Id,
                    area.Name,
                    area.Slug,
                    area.ShortDescription,
                    area.Description,
                    area.CoverImageUrl,
                    area.SortOrder,
                    area.IsActive,
                    area.CreatedAt,
                    area.UpdatedAt))
                .ToListAsync(ct);

            var importantAnnouncements = await _db.Announcements
                .AsNoTracking()
                .Where(announcement =>
                    announcement.PublishedAt.HasValue
                    && announcement.PublishedAt <= utcNow
                    && announcement.StartsAt <= utcNow
                    && (!announcement.ExpiresAt.HasValue || announcement.ExpiresAt > utcNow)
                    && announcement.Importance != AnnouncementImportance.Normal)
                .OrderByDescending(announcement =>
                    announcement.Importance == AnnouncementImportance.Urgent ? 2 : 1)
                .ThenByDescending(announcement => announcement.StartsAt)
                .Take(3)
                .Select(announcement => new AnnouncementSummaryDto(
                    announcement.Id,
                    announcement.Slug,
                    announcement.Title,
                    announcement.Summary,
                    announcement.StartsAt,
                    announcement.ExpiresAt,
                    announcement.PublishedAt,
                    announcement.Importance == AnnouncementImportance.Urgent
                        ? nameof(AnnouncementImportance.Urgent)
                        : nameof(AnnouncementImportance.Important),
                    announcement.ActionLabel,
                    announcement.ActionUrl,
                    true,
                    false)
                {
                    Area = announcement.Area == null
                        ? null
                        : new AreaReferenceDto(
                            announcement.Area.Id,
                            announcement.Area.Name,
                            announcement.Area.Slug),
                })
                .ToListAsync(ct);

            var blogProjections = await _db.BlogPosts
                .AsNoTracking()
                .Where(post => post.PublishedAt.HasValue && post.PublishedAt <= utcNow)
                .OrderByDescending(post => post.IsFeatured)
                .ThenByDescending(post => post.PublishedAt ?? post.CreatedAt)
                .Take(5)
                .Select(post => new
                {
                    post.Id,
                    post.Slug,
                    post.Title,
                    post.Excerpt,
                    post.HeroImageUrl,
                    post.PublishedAt,
                    post.IsFeatured,
                    post.Origin,
                    post.VerifiedAt,
                    post.TimePerspective,
                    Area = post.Area == null
                        ? null
                        : new AreaReferenceDto(post.Area.Id, post.Area.Name, post.Area.Slug),
                })
                .ToListAsync(ct);

            var latestBlogPosts = blogProjections
                .Select(post => new BlogPostSummaryDto(
                    post.Id,
                    post.Slug,
                    post.Title,
                    post.Excerpt,
                    post.HeroImageUrl,
                    post.PublishedAt,
                    post.IsFeatured,
                    post.Origin?.ToString(),
                    post.VerifiedAt)
                {
                    Area = post.Area,
                    TimePerspective = post.TimePerspective?.ToString(),
                })
                .ToList();

            var response = new HomeResponse(
                latestNews,
                galleryHighlights,
                areas,
                importantAnnouncements,
                latestBlogPosts);
            return Ok(response);
        }
    }
}
