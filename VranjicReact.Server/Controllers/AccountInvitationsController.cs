using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/account/invitations")]
public sealed class AccountInvitationsController(AccountInvitationService invitations, IOptions<AccountEmailOptions> options) : ControllerBase
{
    [HttpGet("availability")]
    [Authorize(Policy = PolicyNames.UserRead)]
    public IActionResult Availability() => Ok(new { enabled = options.Value.Enabled });

    [HttpPost]
    [Authorize(Policy = PolicyNames.UserUpdate)]
    [EnableRateLimiting("account-invitations")]
    public async Task<IActionResult> Invite(InviteUserRequest request, CancellationToken ct) =>
        Respond(await invitations.InviteAsync(request, User.FindFirstValue(ClaimTypes.NameIdentifier), ct));

    [HttpPost("{id}/resend")]
    [Authorize(Policy = PolicyNames.UserUpdate)]
    [EnableRateLimiting("account-invitations")]
    public async Task<IActionResult> Resend(string id, CancellationToken ct) =>
        Respond(await invitations.ResendAsync(id, User.FindFirstValue(ClaimTypes.NameIdentifier), ct));

    [HttpPost("accept")]
    [AllowAnonymous]
    [EnableRateLimiting("account-invitations")]
    public async Task<IActionResult> Accept(AcceptInvitationRequest request, CancellationToken ct) =>
        Respond(await invitations.AcceptAsync(request, ct));

    private IActionResult Respond(AccountOperationResult result) => result.StatusCode == 204 ? NoContent()
        : result.Invitation is not null ? StatusCode(result.StatusCode, result.Invitation)
        : StatusCode(result.StatusCode, new { message = result.Error });
}
