namespace VranjicReact.Server.Contracts;

public record SubmitForReviewRequest(string RowVersion);

public record ModerationDecisionRequest(string Decision, string? Comment, string RowVersion);

public record PublishContentRequest(string RowVersion, DateTime? PublishedAt);

public record ModerationHistoryEntryDto(int Id, string Action, string? PreviousStatus,
    string NewStatus, string? ActorUserId, string? Comment, DateTime CreatedAt);

public record ModerationHistoryPageDto(IReadOnlyList<ModerationHistoryEntryDto> Items, int? NextBeforeId);

public record ModerationQueueItemDto(
    string ContentType,
    int Id,
    string Title,
    string Slug,
    AreaReferenceDto? Area,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string RowVersion);

public record AreaModeratorAssignmentDto(
    int Id,
    string UserId,
    string UserEmail,
    AreaReferenceDto Area,
    bool IsActive,
    DateTime AssignedAt,
    DateTime? EndsAt,
    string Status);

public record UpsertAreaModeratorAssignmentRequest(
    string UserId,
    int AreaId,
    DateTime? EndsAt);
