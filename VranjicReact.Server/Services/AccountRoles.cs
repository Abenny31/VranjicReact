using Microsoft.AspNetCore.Identity;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Services;

public static class AccountRoles
{
    public static (List<string> resolvedRoles, string? missingRole) ResolveRoles(IEnumerable<string>? roles)
    {
        var requested = (roles ?? Array.Empty<string>())
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => r.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var resolved = requested
            .Select(role => RoleNames.IdMap.Keys.FirstOrDefault(name => string.Equals(name, role, StringComparison.OrdinalIgnoreCase)))
            .Where(name => name is not null)
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (resolved.Count == requested.Count)
        {
            return (resolved, null);
        }

        var missing = requested.First(role => !RoleNames.IdMap.Keys.Any(name => string.Equals(name, role, StringComparison.OrdinalIgnoreCase)));
        return (resolved, missing);
    }

    public static async Task<IdentityResult> EnsureRolesExistAsync(RoleManager<IdentityRole> roleManager, IEnumerable<string> roles)
    {
        foreach (var role in roles)
        {
            if (await roleManager.RoleExistsAsync(role))
            {
                continue;
            }

            if (!RoleNames.IdMap.TryGetValue(role, out var roleId))
            {
                return IdentityResult.Failed(new IdentityError { Description = $"Uloga '{role}' nije konfigurirana." });
            }

            var createResult = await roleManager.CreateAsync(new IdentityRole
            {
                Id = roleId,
                Name = role,
                NormalizedName = role.ToUpperInvariant(),
            });

            if (!createResult.Succeeded)
            {
                return createResult;
            }
        }

        return IdentityResult.Success;
    }
}
