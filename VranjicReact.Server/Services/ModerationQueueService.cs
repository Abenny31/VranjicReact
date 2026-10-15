using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Services;

public sealed class ModerationQueueService(VranjicContext db, AreaModerationService permissions)
{
    public async Task<List<ModerationQueueItemDto>> GetAsync(ClaimsPrincipal user, int page, int pageSize, CancellationToken ct)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var now = DateTime.UtcNow;
        var manager = permissions.IsContentManager(user);
        var areas = db.AreaModeratorAssignments.AsNoTracking()
            .Where(a => a.UserId == userId && a.IsActive && (!a.EndsAt.HasValue || a.EndsAt > now))
            .Select(a => a.AreaId);
        var news = db.News.AsNoTracking()
            .Where(a => a.EditorialStatus == EditorialStatus.PendingReview && a.CreatedByUserId != userId
                && (manager || (a.AreaId.HasValue && areas.Contains(a.AreaId.Value))))
            .Select(a => new QueueRow
            {
                ContentType = "News", Id = a.Id, Title = a.Title, Slug = a.Slug,
                AreaId = a.AreaId, AreaName = a.Area == null ? null : a.Area.Name,
                AreaSlug = a.Area == null ? null : a.Area.Slug,
                CreatedAt = a.CreatedAt, UpdatedAt = a.UpdatedAt, RowVersion = a.RowVersion,
            });
        var blog = db.BlogPosts.AsNoTracking()
            .Where(a => a.EditorialStatus == EditorialStatus.PendingReview && a.CreatedByUserId != userId
                && (manager || (a.AreaId.HasValue && areas.Contains(a.AreaId.Value))))
            .Select(a => new QueueRow
            {
                ContentType = "Blog", Id = a.Id, Title = a.Title, Slug = a.Slug,
                AreaId = a.AreaId, AreaName = a.Area == null ? null : a.Area.Name,
                AreaSlug = a.Area == null ? null : a.Area.Slug,
                CreatedAt = a.CreatedAt, UpdatedAt = a.UpdatedAt, RowVersion = a.RowVersion,
            });
        var announcements = db.Announcements.AsNoTracking()
            .Where(a => a.EditorialStatus == EditorialStatus.PendingReview && a.CreatedByUserId != userId
                && (manager || (a.AreaId.HasValue && areas.Contains(a.AreaId.Value))))
            .Select(a => new QueueRow
            {
                ContentType = "Announcement", Id = a.Id, Title = a.Title, Slug = a.Slug,
                AreaId = a.AreaId, AreaName = a.Area == null ? null : a.Area.Name,
                AreaSlug = a.Area == null ? null : a.Area.Slug,
                CreatedAt = a.CreatedAt, UpdatedAt = a.UpdatedAt, RowVersion = a.RowVersion,
            });
        var gallery = db.GalleryAlbums.AsNoTracking()
            .Where(a => a.EditorialStatus == EditorialStatus.PendingReview && a.CreatedByUserId != userId
                && (manager || (a.AreaId.HasValue && areas.Contains(a.AreaId.Value))))
            .Select(a => new QueueRow
            {
                ContentType = "Gallery", Id = a.Id, Title = a.Title, Slug = "",
                AreaId = a.AreaId, AreaName = a.Area == null ? null : a.Area.Name,
                AreaSlug = a.Area == null ? null : a.Area.Slug,
                CreatedAt = a.CreatedAt, UpdatedAt = a.UpdatedAt, RowVersion = a.RowVersion,
            });
        // Apply ordering and pagination to the combined SQL query, not four separately truncated lists.
        var rows = await news.Concat(blog).Concat(announcements).Concat(gallery)
            .OrderBy(a => a.UpdatedAt ?? a.CreatedAt).ThenBy(a => a.ContentType).ThenBy(a => a.Id)
            .Skip((page - 1) * pageSize).Take(pageSize + 1).ToListAsync(ct);
        return rows.Select(a => new ModerationQueueItemDto(a.ContentType, a.Id, a.Title, a.Slug,
            a.AreaId.HasValue && a.AreaName != null && a.AreaSlug != null
                ? new AreaReferenceDto(a.AreaId.Value, a.AreaName, a.AreaSlug) : null,
            "PendingReview", a.CreatedAt, a.UpdatedAt, Convert.ToBase64String(a.RowVersion))).ToList();
    }

    private sealed class QueueRow
    {
        public string ContentType { get; init; } = string.Empty;
        public int Id { get; init; }
        public string Title { get; init; } = string.Empty;
        public string Slug { get; init; } = string.Empty;
        public int? AreaId { get; init; }
        public string? AreaName { get; init; }
        public string? AreaSlug { get; init; }
        public DateTime CreatedAt { get; init; }
        public DateTime? UpdatedAt { get; init; }
        public byte[] RowVersion { get; init; } = [];
    }
}
