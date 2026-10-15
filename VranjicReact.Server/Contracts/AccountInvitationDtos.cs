using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Contracts;

public record InviteUserRequest([Required, EmailAddress, MaxLength(256)] string Email, [Required] IReadOnlyList<string> Roles, string? Nickname = null);
public record AcceptInvitationRequest([Required] string UserId, [Required, MaxLength(4096)] string Token, [Required, MaxLength(256)] string Password);
public record InvitationResult(string UserId, bool EmailSent, string Message);
