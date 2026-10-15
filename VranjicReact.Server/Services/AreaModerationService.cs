using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Data;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Services;

public sealed class AreaModerationService(VranjicContext db)
{
    public bool IsContentManager(ClaimsPrincipal user) =>
        user.Identity?.IsAuthenticated == true && RoleNames.ContentManage.Any(user.IsInRole);

    public async Task<bool> CanModerateAsync(
        ClaimsPrincipal user,
        string? creatorUserId,
        int? areaId,
        CancellationToken cancellationToken)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return false;
        }

        var isManager = IsContentManager(user);
        var isModerator = user.IsInRole(RoleNames.Moderator);
        if (isManager)
        {
            return CanModerate(userId, creatorUserId, areaId, true, isModerator, new HashSet<int>());
        }

        if (!isModerator || areaId is null)
        {
            return false;
        }

        var utcNow = DateTime.UtcNow;
        var activeAreaIds = await db.AreaModeratorAssignments
            .AsNoTracking()
            .Where(
                assignment => assignment.UserId == userId
                    && assignment.IsActive
                    && (!assignment.EndsAt.HasValue || assignment.EndsAt > utcNow))
            .Select(assignment => assignment.AreaId)
            .ToHashSetAsync(cancellationToken);
        return CanModerate(userId, creatorUserId, areaId, false, true, activeAreaIds);
    }

    public bool CanEdit(ClaimsPrincipal user, string? creatorUserId, Models.EditorialStatus? status)
    {
        if (IsContentManager(user))
        {
            return true;
        }

        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return !string.IsNullOrWhiteSpace(userId)
            && string.Equals(userId, creatorUserId, StringComparison.Ordinal)
            && status is Models.EditorialStatus.Draft
                or Models.EditorialStatus.ChangesRequested
                or Models.EditorialStatus.Rejected;
    }

    public static bool IsActiveAssignment(bool isActive, DateTime? endsAt, DateTime utcNow) =>
        isActive && (!endsAt.HasValue || endsAt > utcNow);

    public static bool CanModerate(
        string? userId,
        string? creatorUserId,
        int? areaId,
        bool isContentManager,
        bool isModerator,
        IReadOnlySet<int> activeAreaIds) =>
        !string.IsNullOrWhiteSpace(userId)
        && !string.Equals(userId, creatorUserId, StringComparison.Ordinal)
        && (isContentManager || (isModerator && areaId.HasValue && activeAreaIds.Contains(areaId.Value)));
}
