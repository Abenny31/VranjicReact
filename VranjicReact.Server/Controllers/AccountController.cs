using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Utils;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<IdentityUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ILogger<AccountController> _logger;
        private readonly UserDirectoryService _directory;
        private readonly AccountProtectionService _protection;
        private readonly UserNicknameService _nicknames;

        public AccountController(
            UserManager<IdentityUser> userManager,
            RoleManager<IdentityRole> roleManager,
            ILogger<AccountController> logger,
            UserDirectoryService directory,
            AccountProtectionService protection,
            UserNicknameService nicknames)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _logger = logger;
            _directory = directory;
            _protection = protection;
            _nicknames = nicknames;
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserProfileDto>> GetCurrentUser()
        {
            var user = await _userManager.GetUserAsync(User);

            if (user is null)
            {
                _logger.LogWarning("Authenticated principal was not found in the user store.");
                return NotFound();
            }

            var roles = await _userManager.GetRolesAsync(user);
            var dto = new UserProfileDto(
                user.Id,
                user.Email ?? user.UserName ?? string.Empty,
                user.EmailConfirmed,
                roles.ToList().AsReadOnly(),
                UserNicknameService.Read(await _userManager.GetClaimsAsync(user)));

            return Ok(dto);
        }

        [Authorize(Policy = PolicyNames.UserRead)]
        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<UserListItemDto>>> GetUsers([FromQuery] UserListQuery options, CancellationToken ct)
        {
            var results = await _directory.ListAsync(options, ct);
            ListPagination.Complete(Response, results, options.Limit);
            return Ok(results);
        }

        [Authorize(Policy = PolicyNames.UserRead)]
        [HttpGet("users/{id}")]
        public async Task<ActionResult<UserListItemDto>> GetUser(string id)
        {
            var user = await _userManager.FindByIdAsync(id);

            if (user is null)
            {
                return NotFound();
            }

            var dto = await BuildUserDtoAsync(user);
            return Ok(dto);
        }

        [Authorize(Policy = PolicyNames.UserCreate)]
        [HttpPost("users")]
        public async Task<ActionResult<UserListItemDto>> CreateUser(CreateUserRequest request)
        {
            var nicknameError = UserNicknameService.Validate(request.Nickname);
            if (nicknameError is not null) return BadRequest(nicknameError);
            if (!User.IsInRole(RoleNames.SuperUser)
                && (request.Roles?.Any() == true || request.ConfirmEmail)) return Forbid();
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest("Email i lozinka su obavezni.");
            }

            var email = request.Email.Trim();
            var existing = await _userManager.FindByEmailAsync(email);

            if (existing is not null)
            {
                return Conflict("Korisnicki racun s navedenim emailom vec postoji.");
            }

            var user = new IdentityUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = request.ConfirmEmail,
            };

            var createResult = await _userManager.CreateAsync(user, request.Password);

            if (!createResult.Succeeded)
            {
                var details = string.Join(", ", createResult.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to create user {Email}: {Details}", email, details);
                return BadRequest(details);
            }

            var (resolvedRoles, missingRole) = AccountRoles.ResolveRoles(request.Roles);

            if (missingRole is not null)
            {
                await _userManager.DeleteAsync(user);
                return BadRequest($"Uloga '{missingRole}' ne postoji.");
            }

            var isCallerSuperUser = User.IsInRole(RoleNames.SuperUser);

            if (!isCallerSuperUser && resolvedRoles.Contains(RoleNames.SuperUser))
            {
                await _userManager.DeleteAsync(user);
                return Forbid();
            }

            if (resolvedRoles.Count > 0)
            {
                var ensureResult = await AccountRoles.EnsureRolesExistAsync(_roleManager, resolvedRoles);
                if (!ensureResult.Succeeded)
                {
                    await _userManager.DeleteAsync(user);
                    var details = string.Join(", ", ensureResult.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed to ensure roles for user {Email}: {Details}", email, details);
                    return BadRequest(details);
                }

                var roleResult = await _userManager.AddToRolesAsync(user, resolvedRoles);
                if (!roleResult.Succeeded)
                {
                    await _userManager.DeleteAsync(user);
                    var details = string.Join(", ", roleResult.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed to assign roles to user {Email}: {Details}", email, details);
                    return BadRequest(details);
                }
            }

            var nicknameResult = await _nicknames.SetAsync(user, request.Nickname);
            if (!nicknameResult.Succeeded)
            {
                var cleanupResult = await _userManager.DeleteAsync(user);
                if (!cleanupResult.Succeeded)
                {
                    _logger.LogError("Failed to remove newly created user {UserId} after nickname save failure", user.Id);
                    return StatusCode(StatusCodes.Status500InternalServerError,
                        "Račun je kreiran, ali nadimak nije spremljen. Provjerite popis korisnika prije ponovnog pokušaja.");
                }
                return BadRequest(string.Join(", ", nicknameResult.Errors.Select(error => error.Description)));
            }
            var dto = await BuildUserDtoAsync(user);
            return Created($"/api/account/users/{user.Id}", dto);
        }

        [Authorize(Policy = PolicyNames.UserUpdate)]
        [HttpPut("users/{id}")]
        public async Task<ActionResult<UserListItemDto>> UpdateUser(string id, UpdateUserRequest request, CancellationToken ct)
        {
            var nicknameError = UserNicknameService.Validate(request.Nickname);
            if (nicknameError is not null) return BadRequest(nicknameError);
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest("Email je obavezan.");
            }

            var (validatedRoles, invalidRole) = AccountRoles.ResolveRoles(request.Roles);
            if (invalidRole is not null) return BadRequest($"Uloga '{invalidRole}' ne postoji.");
            await using var transaction = await _protection.BeginMutationAsync(ct);
            var user = await _userManager.FindByIdAsync(id);

            if (user is null)
            {
                return NotFound();
            }

            var protectionError = await _protection.ValidateAsync(user, false, request.EmailConfirmed,
                request.Roles is null ? null : validatedRoles, ct);
            if (protectionError is not null) return Conflict(protectionError);
            if (request.EmailConfirmed && user.PasswordHash is null
                && (await _userManager.GetClaimsAsync(user)).Any(c => c.Type == AccountInvitationService.PendingClaim))
                return Conflict("E-mail pozvanog korisnika potvrđuje se prihvaćanjem pozivnice.");
            if (await _protection.IsSeedAsync(user, ct)) await _protection.MarkSeedAsync(user);

            var previousRoles = await _userManager.GetRolesAsync(user);
            var previouslyConfirmed = user.EmailConfirmed;
            var email = request.Email.Trim();

            if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                var existing = await _userManager.FindByEmailAsync(email);
                if (existing is not null && !string.Equals(existing.Id, user.Id, StringComparison.Ordinal))
                {
                    return Conflict("Korisnicki racun s navedenim emailom vec postoji.");
                }

                user.Email = email;
                user.UserName = email;
            }

            user.EmailConfirmed = request.EmailConfirmed;

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                var details = string.Join(", ", updateResult.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to update user {UserId}: {Details}", id, details);
                return BadRequest(details);
            }

            if (request.Roles is not null)
            {
                var resolvedSet = validatedRoles.ToHashSet(StringComparer.OrdinalIgnoreCase);
                var currentSet = previousRoles.ToHashSet(StringComparer.OrdinalIgnoreCase);

                var toRemove = previousRoles.Where(role => !resolvedSet.Contains(role)).ToArray();
                var toAdd = validatedRoles.Where(role => !currentSet.Contains(role)).ToArray();

                if (toRemove.Length > 0)
                {
                    var removeResult = await _userManager.RemoveFromRolesAsync(user, toRemove);
                    if (!removeResult.Succeeded)
                    {
                        var details = string.Join(", ", removeResult.Errors.Select(e => e.Description));
                        _logger.LogWarning("Failed to remove roles from user {UserId}: {Details}", id, details);
                        return BadRequest(details);
                    }
                }

                if (toAdd.Length > 0)
                {
                    var ensureResult = await AccountRoles.EnsureRolesExistAsync(_roleManager, toAdd);
                    if (!ensureResult.Succeeded)
                    {
                        var details = string.Join(", ", ensureResult.Errors.Select(e => e.Description));
                        _logger.LogWarning("Failed to ensure roles for user {UserId}: {Details}", id, details);
                        return BadRequest(details);
                    }

                    var addResult = await _userManager.AddToRolesAsync(user, toAdd);
                    if (!addResult.Succeeded)
                    {
                        var details = string.Join(", ", addResult.Errors.Select(e => e.Description));
                        _logger.LogWarning("Failed to assign roles to user {UserId}: {Details}", id, details);
                        return BadRequest(details);
                    }
                }
            }

            var nicknameResult = await _nicknames.SetAsync(user, request.Nickname);
            if (!nicknameResult.Succeeded) return BadRequest(string.Join(", ", nicknameResult.Errors.Select(error => error.Description)));
            await transaction.CommitAsync(ct);
            var dto = await BuildUserDtoAsync(user);
            _logger.LogInformation("User {UserId} updated by {ActorId}: roles {PreviousRoles} -> {Roles}, confirmed {PreviouslyConfirmed} -> {Confirmed}",
                user.Id, User.FindFirstValue(ClaimTypes.NameIdentifier), string.Join(",", previousRoles), string.Join(",", dto.Roles), previouslyConfirmed, user.EmailConfirmed);
            return Ok(dto);
        }

        [Authorize(Policy = PolicyNames.UserDelete)]
        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(string id, CancellationToken ct)
        {
            await using var transaction = await _protection.BeginMutationAsync(ct);
            var user = await _userManager.FindByIdAsync(id);

            if (user is null)
            {
                return NotFound();
            }

            var protectionError = await _protection.ValidateAsync(user, true, false, null, ct);
            if (protectionError is not null) return Conflict(protectionError);

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(currentUserId) && string.Equals(currentUserId, user.Id, StringComparison.Ordinal))
            {
                return BadRequest("Ne mozete obrisati vlastiti korisnicki racun.");
            }

            var targetIsSuperUser = await _userManager.IsInRoleAsync(user, RoleNames.SuperUser);
            if (targetIsSuperUser && !User.IsInRole(RoleNames.SuperUser))
            {
                return Forbid();
            }

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                var details = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to delete user {UserId}: {Details}", id, details);
                return BadRequest(details);
            }

            await transaction.CommitAsync(ct);
            _logger.LogInformation("User {UserId} deleted by {ActorId}", user.Id, currentUserId);
            return NoContent();
        }

        [Authorize(Policy = PolicyNames.SelfService)]
        [HttpPost("me/password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return BadRequest("Trenutna i nova lozinka su obavezne.");
            }

            if (string.Equals(request.CurrentPassword, request.NewPassword, StringComparison.Ordinal))
            {
                return BadRequest("Nova lozinka mora biti drugacija od postojece.");
            }

            var user = await _userManager.GetUserAsync(User);

            if (user is null)
            {
                _logger.LogWarning("Authenticated principal was not found in the user store.");
                return NotFound();
            }

            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);

            if (!result.Succeeded)
            {
                var details = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogInformation("Failed to change password for user {UserId}: {Details}", user.Id, details);
                return BadRequest(details);
            }

            return NoContent();
        }

        [Authorize(Policy = PolicyNames.UserApprove)]
        [HttpPost("users/{id}/approve")]
        public async Task<ActionResult<UserListItemDto>> ApproveUser(string id)
        {
            var user = await _userManager.FindByIdAsync(id);

            if (user is null)
            {
                return NotFound();
            }

            if (user.PasswordHash is null && (await _userManager.GetClaimsAsync(user)).Any(c => c.Type == AccountInvitationService.PendingClaim))
                return Conflict("E-mail pozvanog korisnika potvrđuje se prihvaćanjem pozivnice.");

            if (!user.EmailConfirmed)
            {
                user.EmailConfirmed = true;
                var result = await _userManager.UpdateAsync(user);
                if (!result.Succeeded)
                {
                    var details = string.Join(", ", result.Errors.Select(e => e.Description));
                    _logger.LogWarning("Failed to approve user {UserId}: {Details}", id, details);
                    return BadRequest(details);
                }
            }

            var dto = await BuildUserDtoAsync(user);
            return Ok(dto);
        }

        private async Task<UserListItemDto> BuildUserDtoAsync(IdentityUser user)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var claims = await _userManager.GetClaimsAsync(user);
            return new UserListItemDto(
                user.Id,
                user.Email ?? user.UserName ?? string.Empty,
                user.EmailConfirmed,
                roles.ToList().AsReadOnly(),
                await _protection.IsSeedAsync(user),
                user.PasswordHash is null && claims.Any(c => c.Type == AccountInvitationService.PendingClaim && c.Value == "true"),
                UserNicknameService.Read(claims));
        }

    }
}
