using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public record MyContentItem(int Id, string ContentType, string Title, string? EditorialStatus,
    string RowVersion, DateTime LastChangedAt, bool CanEdit, bool CanSubmit);
public record MyContentPage(IReadOnlyList<MyContentItem> Items, int Page, bool HasMore);

public sealed class MyContentService(VranjicContext db, AreaModerationService permissions)
{
    public async Task<MyContentPage> GetAsync(ClaimsPrincipal user, int page, CancellationToken ct)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return new([], page, false);
        var rows = await BuildQuery(userId).OrderByDescending(row => row.LastChangedAt)
            .ThenBy(row => row.ContentType).ThenByDescending(row => row.Id).Skip((page - 1) * 20).Take(21).ToListAsync(ct);
        return new(rows.Take(20).Select(row =>
        {
            var canEdit = permissions.CanEdit(user, userId, row.Status);
            return new MyContentItem(row.Id, row.ContentType, row.Title, row.Status?.ToString(),
                Convert.ToBase64String(row.RowVersion), row.LastChangedAt, canEdit,
                canEdit && EditorialWorkflowService.CanSubmit(row.Status));
        }).ToList(), page, rows.Count > 20);
    }

    // Scope every branch to the current account, including administrators; omit bodies/media.
    internal IQueryable<Row> BuildQuery(string userId) =>
        db.News.AsNoTracking().Where(item => item.CreatedByUserId == userId).Select(item => new Row
        { Id = item.Id, ContentType = "News", Title = item.Title, Status = item.EditorialStatus,
            RowVersion = item.RowVersion, LastChangedAt = item.UpdatedAt ?? item.CreatedAt })
        .Concat(db.BlogPosts.AsNoTracking().Where(item => item.CreatedByUserId == userId).Select(item => new Row
        { Id = item.Id, ContentType = "Blog", Title = item.Title, Status = item.EditorialStatus,
            RowVersion = item.RowVersion, LastChangedAt = item.UpdatedAt ?? item.CreatedAt }))
        .Concat(db.Announcements.AsNoTracking().Where(item => item.CreatedByUserId == userId).Select(item => new Row
        { Id = item.Id, ContentType = "Announcement", Title = item.Title, Status = item.EditorialStatus,
            RowVersion = item.RowVersion, LastChangedAt = item.UpdatedAt ?? item.CreatedAt }))
        .Concat(db.GalleryAlbums.AsNoTracking().Where(item => item.CreatedByUserId == userId).Select(item => new Row
        { Id = item.Id, ContentType = "Gallery", Title = item.Title, Status = item.EditorialStatus,
            RowVersion = item.RowVersion, LastChangedAt = item.UpdatedAt ?? item.CreatedAt }));

    internal sealed class Row
    {
        public int Id { get; init; }
        public string ContentType { get; init; } = "";
        public string Title { get; init; } = "";
        public EditorialStatus? Status { get; init; }
        public byte[] RowVersion { get; init; } = [];
        public DateTime LastChangedAt { get; init; }
    }
}
