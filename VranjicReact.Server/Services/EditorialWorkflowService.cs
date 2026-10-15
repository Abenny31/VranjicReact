using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Services;

public enum EditorialOperation { Submit, Decide, Publish, Archive }
public record WorkflowResult(int StatusCode, string? Error = null);

public sealed class EditorialWorkflowService(VranjicContext db, AreaModerationService permissions)
{
    public async Task<IEditorialContent?> FindAsync(string type, int id, CancellationToken ct) => type.ToLowerInvariant() switch
    {
        "news" => await db.News.FindAsync([id], ct),
        "blog" => await db.BlogPosts.FindAsync([id], ct),
        "announcement" => await db.Announcements.FindAsync([id], ct),
        "gallery" => await db.GalleryAlbums.FindAsync([id], ct),
        _ => null,
    };

    public async Task<bool> CanPreviewAsync(ClaimsPrincipal user, IEditorialContent content, CancellationToken ct)
    {
        if (user.Identity?.IsAuthenticated != true) return false;
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return permissions.IsContentManager(user)
            || (!string.IsNullOrWhiteSpace(userId) && userId == content.CreatedByUserId)
            || (content is BlogPost && user.IsInRole(RoleNames.Verifier))
            || await permissions.CanModerateAsync(user, content.CreatedByUserId, content.AreaId, ct);
    }

    public static bool CanSubmit(EditorialStatus? status) => status is
        EditorialStatus.Draft or EditorialStatus.ChangesRequested or EditorialStatus.Rejected;

    public static bool MatchesVersion(byte[] current, string? supplied)
    {
        if (string.IsNullOrWhiteSpace(supplied)) return false;
        try { return current.AsSpan().SequenceEqual(Convert.FromBase64String(supplied)); }
        catch (FormatException) { return false; }
    }

    public void RecordPublication(IEditorialContent content, ClaimsPrincipal user)
    {
        if (content.EditorialStatus == EditorialStatus.Published)
            Record(content, user, ModerationActionType.Published, null, "Izravna administratorska objava.");
    }

    public void ResetAfterEdit(IEditorialContent content, ClaimsPrincipal user)
    {
        var previous = content.EditorialStatus;
        content.UpdatedAt = DateTime.UtcNow;
        content.EditorialStatus = EditorialStatus.Draft;
        content.PublishedAt = null;
        if (previous is not null and not EditorialStatus.Draft)
            Record(content, user, ModerationActionType.ApprovalReset, previous, "Sadržaj je izmijenjen; potreban je ponovni pregled.");
    }

    public void Record(IEditorialContent content, ClaimsPrincipal user, ModerationActionType action,
        EditorialStatus? previous, string? comment)
    {
        var audit = new ContentModerationAction
        {
            Action = action, PreviousStatus = previous,
            NewStatus = content.EditorialStatus ?? EditorialStatus.Draft,
            ActorUserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            CreatedAt = DateTime.UtcNow,
        };
        switch (content)
        {
            case News news: audit.News = news; break;
            case BlogPost blog: audit.BlogPost = blog; break;
            case Announcement announcement: audit.Announcement = announcement; break;
            case GalleryAlbum album: audit.GalleryAlbum = album; break;
            default: throw new ArgumentException("Unsupported editorial content.", nameof(content));
        }
        db.ContentModerationActions.Add(audit);
    }

    public async Task<WorkflowResult> ExecuteAsync(string type, int id, EditorialOperation operation,
        string rowVersion, ClaimsPrincipal user, CancellationToken ct,
        string? decision = null, string? comment = null, DateTime? publishedAt = null)
    {
        var content = await FindAsync(type, id, ct);
        if (content is null) return new(404);
        var allowed = operation switch
        {
            EditorialOperation.Submit => permissions.CanEdit(user, content.CreatedByUserId, content.EditorialStatus),
            EditorialOperation.Decide => await permissions.CanModerateAsync(user, content.CreatedByUserId, content.AreaId, ct),
            _ => permissions.IsContentManager(user),
        };
        if (!allowed) return new(403);
        if (!MatchesVersion(content.RowVersion, rowVersion)) return new(409, ConcurrencyMessage);
        if (comment?.Trim().Length > 1000) return new(400, "Komentar može sadržavati najviše 1000 znakova.");

        var previous = content.EditorialStatus;
        ModerationActionType action;
        switch (operation)
        {
            case EditorialOperation.Submit:
                if (!CanSubmit(previous)) return new(409, "Sadržaj u ovom statusu nije moguće poslati na pregled.");
                if (content.AreaId is null && !permissions.IsContentManager(user))
                    return new(400, "Za moderatorski pregled potrebno je odabrati područje.");
                content.EditorialStatus = EditorialStatus.PendingReview;
                content.PublishedAt = null;
                action = ModerationActionType.Submitted;
                break;
            case EditorialOperation.Decide:
                if (previous != EditorialStatus.PendingReview) return new(409, "Sadržaj više nije na čekanju za pregled.");
                switch (decision?.Trim().ToLowerInvariant())
                {
                    case "approve": content.EditorialStatus = EditorialStatus.Approved; action = ModerationActionType.Approved; break;
                    case "requestchanges": content.EditorialStatus = EditorialStatus.ChangesRequested; action = ModerationActionType.ChangesRequested; break;
                    case "reject": content.EditorialStatus = EditorialStatus.Rejected; action = ModerationActionType.Rejected; break;
                    default: return new(400, "Odluka mora biti Approve, RequestChanges ili Reject.");
                }
                if (action != ModerationActionType.Approved && string.IsNullOrWhiteSpace(comment))
                    return new(400, "Za izmjene i odbijanje potreban je komentar.");
                break;
            case EditorialOperation.Publish:
                if (previous == EditorialStatus.Published) return new(409, "Sadržaj je već objavljen.");
                content.EditorialStatus = EditorialStatus.Published;
                content.PublishedAt = publishedAt?.ToUniversalTime() ?? DateTime.UtcNow;
                action = ModerationActionType.Published;
                comment = previous == EditorialStatus.Approved ? null : "Izravna administratorska objava bez moderatorskog odobrenja.";
                break;
            case EditorialOperation.Archive:
                if (previous == EditorialStatus.Archived) return new(204);
                content.EditorialStatus = EditorialStatus.Archived;
                content.PublishedAt = null;
                action = ModerationActionType.Archived;
                break;
            default: throw new ArgumentOutOfRangeException(nameof(operation));
        }
        content.UpdatedAt = DateTime.UtcNow;
        Record(content, user, action, previous, comment);
        try { await db.SaveChangesAsync(ct); return new(204); }
        catch (DbUpdateConcurrencyException) { return new(409, ConcurrencyMessage); }
    }

    public const string ConcurrencyMessage = "Sadržaj je u međuvremenu promijenjen. Osvježite podatke i pokušajte ponovno.";

    public async Task<ModerationHistoryPageDto> GetHistoryAsync(string type, int id, int? beforeId, CancellationToken ct)
    {
        var rows = await HistoryQuery(type, id).AsNoTracking()
            .Where(a => !beforeId.HasValue || a.Id < beforeId.Value)
            .OrderByDescending(a => a.Id).Take(51)
            .Select(a => new ModerationHistoryEntryDto(a.Id, a.Action.ToString(),
                a.PreviousStatus.HasValue ? a.PreviousStatus.Value.ToString() : null,
                a.NewStatus.ToString(), a.ActorUserId, a.Comment, a.CreatedAt)).ToListAsync(ct);
        return new(rows.Take(50).ToList(), rows.Count > 50 ? rows[49].Id : null);
    }

    private IQueryable<ContentModerationAction> HistoryQuery(string type, int id) => type.ToLowerInvariant() switch
    {
        "news" => db.ContentModerationActions.Where(a => a.NewsId == id),
        "blog" => db.ContentModerationActions.Where(a => a.BlogPostId == id),
        "announcement" => db.ContentModerationActions.Where(a => a.AnnouncementId == id),
        "gallery" => db.ContentModerationActions.Where(a => a.GalleryAlbumId == id),
        _ => db.ContentModerationActions.Where(a => false),
    };
}
