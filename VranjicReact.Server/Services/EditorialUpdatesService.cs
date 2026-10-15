using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Services;

public sealed class EditorialUpdatesService(VranjicContext db, AreaModerationService permissions)
{
    public async Task<EditorialUpdatesPageDto> GetAsync(ClaimsPrincipal user, string? kind,
        EditorialStatus? status, string? search, int page, int pageSize, int? tagId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var manager = permissions.IsContentManager(user);
        // Preserve the existing list visibility: managers see all; contributors see their own and public content.
        var news = db.News.AsNoTracking()
            .Where(n => !tagId.HasValue || n.NewsTags.Any(link => link.TagId == tagId && link.Tag.IsActive))
            .Where(n => manager || (userId != null && n.CreatedByUserId == userId)
                || (n.EditorialStatus == EditorialStatus.Published && n.PublishedAt <= now))
            .Select(n => new EditorialRow
            {
                Id = n.Id, ContentType = "News", Title = n.Title, Slug = n.Slug,
                Status = n.EditorialStatus, RowVersion = n.RowVersion, LastChangedAt = n.UpdatedAt ?? n.CreatedAt,
                PublishedAt = n.PublishedAt, StartsAt = null, ExpiresAt = null,
                AuthorId = n.CreatedByUserId, AreaId = n.AreaId,
            });
        var announcements = db.Announcements.AsNoTracking()
            .Where(a => !tagId.HasValue || a.AnnouncementTags.Any(link => link.TagId == tagId && link.Tag.IsActive))
            .Where(a => manager || (userId != null && a.CreatedByUserId == userId)
                || (a.EditorialStatus == EditorialStatus.Published && a.PublishedAt <= now && a.StartsAt <= now))
            .Select(a => new EditorialRow
            {
                Id = a.Id, ContentType = "Announcement", Title = a.Title, Slug = a.Slug,
                Status = a.EditorialStatus, RowVersion = a.RowVersion, LastChangedAt = a.UpdatedAt ?? a.CreatedAt,
                PublishedAt = a.PublishedAt, StartsAt = a.StartsAt, ExpiresAt = a.ExpiresAt,
                AuthorId = a.CreatedByUserId, AreaId = a.AreaId,
            });
        var query = kind == "News" ? news : kind == "Announcement" ? announcements : news.Concat(announcements);
        if (status.HasValue) query = query.Where(row => row.Status == status);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(row => row.Title.Contains(search));
        var rows = await query.OrderByDescending(row => row.LastChangedAt)
            .ThenBy(row => row.ContentType).ThenByDescending(row => row.Id)
            .Skip((page - 1) * pageSize).Take(pageSize + 1).ToListAsync(ct);

        var assignedAreas = user.IsInRole(RoleNames.Moderator) && !manager
            ? await db.AreaModeratorAssignments.AsNoTracking()
                .Where(a => a.UserId == userId && a.IsActive && (!a.EndsAt.HasValue || a.EndsAt > now))
                .Select(a => a.AreaId).ToHashSetAsync(ct)
            : new HashSet<int>();
        var items = rows.Take(pageSize).Select(row =>
        {
            var canEdit = permissions.CanEdit(user, row.AuthorId, row.Status);
            var canViewHistory = manager || (!string.IsNullOrWhiteSpace(userId) && userId == row.AuthorId)
                || AreaModerationService.CanModerate(userId, row.AuthorId, row.AreaId, false,
                    user.IsInRole(RoleNames.Moderator), assignedAreas);
            var active = row.ContentType == "Announcement" && row.StartsAt.HasValue
                && AnnouncementSchedule.IsActive(row.PublishedAt, row.StartsAt.Value, row.ExpiresAt, now);
            return new EditorialUpdateDto(row.Id, row.ContentType, row.Title, row.Slug,
                row.Status?.ToString(), Convert.ToBase64String(row.RowVersion), row.LastChangedAt,
                row.PublishedAt, row.StartsAt, row.ExpiresAt, active, AnnouncementSchedule.IsExpired(row.ExpiresAt, now),
                canEdit, canEdit && EditorialWorkflowService.CanSubmit(row.Status), canViewHistory);
        }).ToList();
        return new(items, page, rows.Count > pageSize);
    }

    // Identical server-side projection on both sides of UNION ALL; never load bodies or audit collections.
    private sealed class EditorialRow
    {
        public int Id { get; init; }
        public string ContentType { get; init; } = string.Empty;
        public string Title { get; init; } = string.Empty;
        public string Slug { get; init; } = string.Empty;
        public EditorialStatus? Status { get; init; }
        public byte[] RowVersion { get; init; } = [];
        public DateTime LastChangedAt { get; init; }
        public DateTime? PublishedAt { get; init; }
        public DateTime? StartsAt { get; init; }
        public DateTime? ExpiresAt { get; init; }
        public string? AuthorId { get; init; }
        public int? AreaId { get; init; }
    }
}
