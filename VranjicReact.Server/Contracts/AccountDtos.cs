using System.Collections.Generic;

namespace VranjicReact.Server.Contracts;

public record UserProfileDto(
    string Id,
    string Email,
    bool EmailConfirmed,
    IReadOnlyList<string> Roles,
    string? Nickname = null);

public record UserListItemDto(
    string Id,
    string Email,
    bool EmailConfirmed,
    IReadOnlyList<string> Roles,
    bool IsProtected = false,
    bool InvitationPending = false,
    string? Nickname = null);

public record CreateUserRequest(
    string Email,
    string Password,
    bool ConfirmEmail,
    IReadOnlyList<string>? Roles = null,
    string? Nickname = null);

public record UpdateUserRequest(
    string Email,
    bool EmailConfirmed,
    IReadOnlyList<string>? Roles = null,
    string? Nickname = null);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

