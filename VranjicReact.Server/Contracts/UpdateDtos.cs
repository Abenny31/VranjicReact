namespace VranjicReact.Server.Contracts;

public sealed class UpdateSummaryDto : ITranslatedDto
{
    string ITranslatedDto.TranslationKind => ContentType == "News" ? "news" : "announcement";
    public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();
    public AreaReferenceDto? Area { get; set; }
    public int? AreaId { get; init; }
    public int Id { get; init; }
    public string ContentType { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public DateTime? PublishedAt { get; init; }
    public int Priority { get; init; }
    public string? AreaName { get; init; }
    public string? AreaSlug { get; init; }
}

public record UpdatesPageDto(IReadOnlyList<UpdateSummaryDto> Items, int Page, bool HasMore);

public record EditorialUpdateDto(
    int Id, string ContentType, string Title, string Slug,
    string? EditorialStatus, string RowVersion, DateTime LastChangedAt,
    DateTime? PublishedAt, DateTime? StartsAt, DateTime? ExpiresAt,
    bool IsActive, bool IsExpired, bool CanEdit, bool CanSubmit, bool CanViewHistory);

public record EditorialUpdatesPageDto(IReadOnlyList<EditorialUpdateDto> Items, int Page, bool HasMore);
