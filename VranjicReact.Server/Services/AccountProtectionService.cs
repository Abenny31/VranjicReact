using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data;
using VranjicReact.Server.Data;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Services;

public sealed class AccountProtectionService(VranjicContext db, UserManager<IdentityUser> users, IConfiguration configuration)
{
    public const string SeedClaim = "dfb:protected-seed";
    public const string ProtectedMessage = "Seedani SuperUser račun nije moguće obrisati, deaktivirati niti mu ukloniti SuperUser ulogu.";
    public const string LastMessage = "Mora ostati barem jedan potvrđen SuperUser račun s postavljenom lozinkom.";

    public async Task<IDbContextTransaction> BeginMutationAsync(CancellationToken ct)
    {
        var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            // Serialize administrative account changes across app instances. Taking an update
            // lock before reading membership avoids two simultaneous last-admin demotions.
            await db.Roles.FromSqlInterpolated($"SELECT * FROM [AspNetRoles] WITH (UPDLOCK, HOLDLOCK) WHERE [NormalizedName] = {"SUPERUSER"}")
                .AsNoTracking().ToListAsync(ct);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    public async Task<bool> IsSeedAsync(IdentityUser user, CancellationToken ct = default) =>
        await db.UserClaims.AnyAsync(c => c.UserId == user.Id && c.ClaimType == SeedClaim && c.ClaimValue == "true", ct)
        || (!string.IsNullOrWhiteSpace(configuration["SeedAdminUser:Email"])
            && string.Equals(user.Email, configuration["SeedAdminUser:Email"]?.Trim(), StringComparison.OrdinalIgnoreCase));

    public async Task MarkSeedAsync(IdentityUser user)
    {
        if ((await users.GetClaimsAsync(user)).Any(c => c.Type == SeedClaim && c.Value == "true")) return;
        var result = await users.AddClaimAsync(user, new Claim(SeedClaim, "true"));
        if (!result.Succeeded) throw new InvalidOperationException("Nije moguće spremiti zaštitu seedanog računa.");
    }

    // Caller keeps this check and the mutation in the same serializable transaction.
    public async Task<string?> ValidateAsync(IdentityUser user, bool deleting, bool emailConfirmed, IReadOnlyCollection<string>? roles, CancellationToken ct)
    {
        var keepsSuperUser = roles is null || roles.Contains(RoleNames.SuperUser, StringComparer.OrdinalIgnoreCase);
        if (!deleting && emailConfirmed && keepsSuperUser) return null;
        if (await IsSeedAsync(user, ct)) return ProtectedMessage;
        if (!await users.IsInRoleAsync(user, RoleNames.SuperUser)) return null;
        var otherUsableSuperUsers = from candidate in db.Users
            join membership in db.UserRoles on candidate.Id equals membership.UserId
            join role in db.Roles on membership.RoleId equals role.Id
            where candidate.Id != user.Id && candidate.EmailConfirmed && candidate.PasswordHash != null
                && (!candidate.LockoutEnabled || candidate.LockoutEnd == null || candidate.LockoutEnd <= DateTimeOffset.UtcNow)
                && role.NormalizedName == "SUPERUSER"
            select candidate.Id;
        return await otherUsableSuperUsers.AnyAsync(ct) ? null : LastMessage;
    }
}
