using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;

namespace VranjicReact.Server.Services;

public sealed class UserDirectoryService(VranjicContext db, IConfiguration configuration)
{
    // Caller enforces UserRead. Fetch one extra row for the existing X-Has-More contract.
    public async Task<List<UserListItemDto>> ListAsync(UserListQuery options, CancellationToken ct)
    {
        var query = db.Users.AsNoTracking();
        var search = options.Search?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(search))
            query = query.Where(user => (user.NormalizedEmail != null && user.NormalizedEmail.Contains(search))
                || (user.NormalizedUserName != null && user.NormalizedUserName.Contains(search))
                || db.UserClaims.Any(claim => claim.UserId == user.Id && claim.ClaimType == UserNicknameService.ClaimType
                    && claim.ClaimValue != null && claim.ClaimValue.ToUpper().Contains(search)));
        if (options.EmailConfirmed is bool confirmed)
            query = query.Where(user => user.EmailConfirmed == confirmed);
        var role = options.Role?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(role))
        {
            var roleUserIds = from assignment in db.UserRoles
                              join assignedRole in db.Roles on assignment.RoleId equals assignedRole.Id
                              where assignedRole.NormalizedName == role
                              select assignment.UserId;
            query = query.Where(user => roleUserIds.Contains(user.Id));
        }

        var seedEmail = configuration["SeedAdminUser:Email"]?.Trim().ToUpperInvariant();
        var users = await query.OrderBy(user => user.Email ?? user.UserName).ThenBy(user => user.Id)
            .Skip((options.Page - 1) * options.Limit).Take(options.Limit + 1)
            .Select(user => new { user.Id, Email = user.Email ?? user.UserName ?? string.Empty, user.EmailConfirmed,
                Nickname = db.UserClaims.Where(claim => claim.UserId == user.Id && claim.ClaimType == UserNicknameService.ClaimType)
                    .OrderBy(claim => claim.Id).Select(claim => claim.ClaimValue).FirstOrDefault(),
                IsProtected = (seedEmail != null && seedEmail != "" && user.NormalizedEmail == seedEmail)
                    || db.UserClaims.Any(c => c.UserId == user.Id && c.ClaimType == AccountProtectionService.SeedClaim && c.ClaimValue == "true"),
                InvitationPending = user.PasswordHash == null && db.UserClaims.Any(c => c.UserId == user.Id
                    && c.ClaimType == AccountInvitationService.PendingClaim && c.ClaimValue == "true") })
            .ToListAsync(ct);
        if (users.Count == 0) return [];

        // One bounded query for all roles on this page, not one UserManager request per person.
        var ids = users.Select(user => user.Id).ToArray();
        var roles = await (from assignment in db.UserRoles.AsNoTracking()
                           join assignedRole in db.Roles.AsNoTracking() on assignment.RoleId equals assignedRole.Id
                           where ids.Contains(assignment.UserId) && assignedRole.Name != null
                           orderby assignedRole.Name
                           select new { assignment.UserId, Name = assignedRole.Name! }).ToListAsync(ct);
        var rolesByUser = roles.ToLookup(roleAssignment => roleAssignment.UserId, roleAssignment => roleAssignment.Name);
        return users.Select(user => new UserListItemDto(user.Id, user.Email, user.EmailConfirmed,
            rolesByUser[user.Id].ToArray(), user.IsProtected, user.InvitationPending, user.Nickname)).ToList();
    }
}
