namespace VranjicReact.Server.Contracts;

public record AnnouncementSummaryDto(
    int Id,
    string Slug,
    string Title,
    string Summary,
    DateTime StartsAt,
    DateTime? ExpiresAt,
    DateTime? PublishedAt,
    string Importance,
    string? ActionLabel,
    string? ActionUrl,
    bool IsActive,
    bool IsExpired) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "announcement";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();

    public AreaReferenceDto? Area { get; init; }
    public string? EditorialStatus { get; init; }
    public string RowVersion { get; init; } = string.Empty;
    public bool CanEdit { get; init; }
    public bool CanSubmit { get; init; }
}

public record AnnouncementDetailDto(
    int Id,
    string Slug,
    string Title,
    string Summary,
    string Body,
    DateTime StartsAt,
    DateTime? ExpiresAt,
    DateTime? PublishedAt,
    string Importance,
    string? ActionLabel,
    string? ActionUrl,
    bool IsActive,
    bool IsExpired,
    DateTime CreatedAt,
    DateTime? UpdatedAt) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "announcement";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();

    public AreaReferenceDto? Area { get; init; }

    public IReadOnlyList<TagDto> Tags { get; init; } = Array.Empty<TagDto>();
    public string? EditorialStatus { get; init; }
    public string RowVersion { get; init; } = string.Empty;
    public bool CanEdit { get; init; }
    public bool CanSubmit { get; init; }
}

public record UpsertAnnouncementRequest(
    string Title,
    string Summary,
    string Body,
    DateTime StartsAt,
    DateTime? ExpiresAt,
    DateTime? PublishedAt,
    string Importance,
    string? ActionLabel,
    string? ActionUrl,
    string? Slug,
    int? AreaId = null,
    IReadOnlyList<int>? TagIds = null,
    string? RowVersion = null,
    IReadOnlyList<TranslationEdit>? Translations = null);
