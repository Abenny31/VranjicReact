using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public sealed class UpdatesService(VranjicContext db)
{
    public async Task<UpdatesPageDto> GetAsync(string? kind, string? area, int page, int pageSize, int? tagId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var news = db.News.AsNoTracking().Where(n => n.PublishedAt <= now
            && n.EditorialStatus == EditorialStatus.Published
            && (!tagId.HasValue || n.NewsTags.Any(link => link.TagId == tagId && link.Tag.IsActive))
            && (area == null || (n.Area != null && n.Area.IsActive && n.Area.Slug == area)))
            .Select(n => new UpdateSummaryDto
            {
                Id = n.Id, ContentType = "News", Slug = n.Slug, Title = n.Title, Summary = n.Excerpt,
                PublishedAt = n.PublishedAt, Priority = 0,
                AreaId = n.AreaId,
                AreaName = n.Area == null ? null : n.Area.Name, AreaSlug = n.Area == null ? null : n.Area.Slug,
            });
        var announcements = db.Announcements.AsNoTracking().Where(a => a.PublishedAt <= now
            && a.EditorialStatus == EditorialStatus.Published && a.StartsAt <= now
            && (!a.ExpiresAt.HasValue || a.ExpiresAt > now)
            && (!tagId.HasValue || a.AnnouncementTags.Any(link => link.TagId == tagId && link.Tag.IsActive))
            && (area == null || (a.Area != null && a.Area.IsActive && a.Area.Slug == area)))
            .Select(a => new UpdateSummaryDto
            {
                Id = a.Id, ContentType = "Announcement", Slug = a.Slug, Title = a.Title, Summary = a.Summary,
                PublishedAt = a.PublishedAt,
                AreaId = a.AreaId,
                Priority = a.Importance == AnnouncementImportance.Urgent ? 2 : a.Importance == AnnouncementImportance.Important ? 1 : 0,
                AreaName = a.Area == null ? null : a.Area.Name, AreaSlug = a.Area == null ? null : a.Area.Slug,
            });
        var query = kind == "News" ? news : kind == "Announcement" ? announcements : news.Concat(announcements);
        var rows = await query.OrderByDescending(a => a.Priority).ThenByDescending(a => a.PublishedAt)
            .ThenBy(a => a.ContentType).ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize).Take(pageSize + 1).ToListAsync(ct);
        return new(rows.Take(pageSize).ToList(), page, rows.Count > pageSize);
    }
}
