using System.Security.Claims;
using Microsoft.AspNetCore.Identity;

namespace VranjicReact.Server.Services;

// A display label in the existing Identity claim store; never an authentication name or role.
public sealed class UserNicknameService(UserManager<IdentityUser> users)
{
    public const string ClaimType = "dfb:nickname";
    public const int MaximumLength = 60;

    public static string? Validate(string? nickname) => nickname is not null
        && (nickname.Trim().Length > MaximumLength || nickname.Any(char.IsControl))
        ? "Nadimak može imati najviše 60 znakova i ne smije sadržavati prijelome redaka."
        : null;

    public static string? Read(IEnumerable<Claim> claims) => claims.FirstOrDefault(claim => claim.Type == ClaimType)?.Value;

    public async Task<IdentityResult> SetAsync(IdentityUser user, string? nickname)
    {
        var error = Validate(nickname);
        if (error is not null) return IdentityResult.Failed(new IdentityError { Code = "InvalidNickname", Description = error });
        // Omitted fields from older clients must not clear a stored nickname.
        if (nickname is null) return IdentityResult.Success;
        var value = nickname.Trim();
        var existing = (await users.GetClaimsAsync(user)).Where(claim => claim.Type == ClaimType).ToArray();
        if (existing.Length == 1 && existing[0].Value == value) return IdentityResult.Success;
        if (value.Length == 0) return existing.Length == 0 ? IdentityResult.Success : await users.RemoveClaimsAsync(user, existing);
        var replacement = new Claim(ClaimType, value);
        if (existing.Length == 0) return await users.AddClaimAsync(user, replacement);
        return await users.ReplaceClaimAsync(user, existing[0], replacement);
    }
}
