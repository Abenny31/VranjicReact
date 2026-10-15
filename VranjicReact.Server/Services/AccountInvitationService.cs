using System.Net.Mail;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;

namespace VranjicReact.Server.Services;

public record AccountOperationResult(int StatusCode, string? Error = null, InvitationResult? Invitation = null);

public sealed class AccountInvitationService(
    VranjicContext db, UserManager<IdentityUser> users, RoleManager<IdentityRole> roles,
    IAccountEmailSender sender, IOptions<AccountEmailOptions> options, ILogger<AccountInvitationService> logger,
    UserNicknameService nicknames)
{
    public const string PendingClaim = "dfb:pending-invitation";
    public const string InvalidMessage = "Pozivnica nije valjana ili je istekla. Zatražite novu pozivnicu.";
    private static string Purpose(IdentityUser user) => "DFB.Invitation:" + user.Email;

    public async Task<AccountOperationResult> InviteAsync(InviteUserRequest request, string? actorId, CancellationToken ct)
    {
        var nicknameError = UserNicknameService.Validate(request.Nickname);
        if (nicknameError is not null) return new(400, nicknameError);
        if (!options.Value.Enabled) return new(503, "Slanje e-maila nije omogućeno.");
        var (resolvedRoles, missingRole) = AccountRoles.ResolveRoles(request.Roles);
        if (missingRole is not null || resolvedRoles.Count == 0) return new(400, "Odaberite barem jednu valjanu ulogu.");
        var email = request.Email.Trim();
        if (await users.FindByEmailAsync(email) is not null) return new(409, "Račun već postoji. Za pozvani račun upotrijebite ponovno slanje pozivnice.");
        var user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = false };
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            var result = await AccountRoles.EnsureRolesExistAsync(roles, resolvedRoles);
            if (result.Succeeded) result = await users.CreateAsync(user);
            if (result.Succeeded) result = await users.AddToRolesAsync(user, resolvedRoles);
            if (result.Succeeded) result = await users.AddClaimAsync(user, new Claim(PendingClaim, "true"));
            if (result.Succeeded) result = await nicknames.SetAsync(user, request.Nickname);
            if (!result.Succeeded) return new(400, string.Join(", ", result.Errors.Select(e => e.Description)));
            await transaction.CommitAsync(ct);
        }
        logger.LogInformation("Account {UserId} invited by {ActorId} with roles {Roles}", user.Id, actorId, string.Join(",", resolvedRoles));
        return await DeliverAsync(user, ct);
    }

    public async Task<AccountOperationResult> ResendAsync(string id, string? actorId, CancellationToken ct)
    {
        if (!options.Value.Enabled) return new(503, "Slanje e-maila nije omogućeno.");
        var user = await users.FindByIdAsync(id);
        if (user is null) return new(404);
        if (!await IsPendingAsync(user, ct)) return new(409, "Račun nema pozivnicu na čekanju.");
        // Issuing a replacement invalidates older invitation tokens.
        var result = await users.UpdateSecurityStampAsync(user);
        if (!result.Succeeded) return new(409, "Račun je izmijenjen. Osvježite popis i pokušajte ponovno.");
        logger.LogInformation("Account invitation {UserId} resent by {ActorId}", id, actorId);
        return await DeliverAsync(user, ct);
    }

    public async Task<AccountOperationResult> AcceptAsync(AcceptInvitationRequest request, CancellationToken ct)
    {
        if (!options.Value.Enabled) return new(503, "Pozivnice trenutačno nisu omogućene.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = await users.FindByIdAsync(request.UserId);
        if (user is null || !await IsPendingAsync(user, ct)
            || !await users.VerifyUserTokenAsync(user, TokenOptions.DefaultProvider, Purpose(user), request.Token))
            return new(400, InvalidMessage);
        var result = await users.AddPasswordAsync(user, request.Password);
        if (!result.Succeeded) return new(400, string.Join(", ", result.Errors.Select(e => e.Description)));
        user.EmailConfirmed = true;
        result = await users.UpdateAsync(user);
        if (result.Succeeded) result = await users.RemoveClaimAsync(user, new Claim(PendingClaim, "true"));
        if (!result.Succeeded) return new(409, InvalidMessage);
        await transaction.CommitAsync(ct);
        logger.LogInformation("Account invitation {UserId} accepted", user.Id);
        return new(204);
    }

    private Task<bool> IsPendingAsync(IdentityUser user, CancellationToken ct) =>
        user.PasswordHash is not null ? Task.FromResult(false) : db.UserClaims.AnyAsync(
            c => c.UserId == user.Id && c.ClaimType == PendingClaim && c.ClaimValue == "true", ct);

    private async Task<AccountOperationResult> DeliverAsync(IdentityUser user, CancellationToken ct)
    {
        var token = await users.GenerateUserTokenAsync(user, TokenOptions.DefaultProvider, Purpose(user));
        // Fragment keeps the secret out of HTTP request URLs and Referer headers.
        var fragment = QueryHelpers.AddQueryString(string.Empty, new Dictionary<string, string?> { ["userId"] = user.Id, ["token"] = token });
        var link = options.Value.PublicBaseUrl.TrimEnd('/') + "/prihvati-pozivnicu#" + fragment.TrimStart('?');
        try
        {
            await sender.SendInvitationAsync(user.Email!, link, ct);
            return new(200, Invitation: new(user.Id, true, "Pozivnica je poslana."));
        }
        catch (Exception exception) when (exception is SmtpException || exception is OperationCanceledException && !ct.IsCancellationRequested)
        {
            // The account remains pending and can be retried; never claim successful delivery.
            logger.LogWarning("Invitation delivery failed for {UserId} ({FailureType})", user.Id, exception.GetType().Name);
            return new(200, Invitation: new(user.Id, false, "Račun je pripremljen, ali e-mail nije poslan. Ponovno pošaljite pozivnicu iz popisa korisnika."));
        }
    }
}
