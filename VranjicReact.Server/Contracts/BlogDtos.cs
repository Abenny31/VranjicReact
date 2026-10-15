namespace VranjicReact.Server.Contracts;

public record BlogPostSummaryDto(
    int Id,
    string Slug,
    string Title,
    string Excerpt,
    string? HeroImageUrl,
    DateTime? PublishedAt,
    bool IsFeatured,
    string? Origin,
    DateTime? VerifiedAt) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "blog";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();

    public AreaReferenceDto? Area { get; init; }

    public string? TimePerspective { get; init; }

    public string? EditorialStatus { get; init; }

    public string RowVersion { get; init; } = string.Empty;

    public bool CanEdit { get; init; }

    public bool CanSubmit { get; init; }

    public string? LatestModerationComment { get; init; }

    public string? LatestModerationAction { get; init; }
}

public record BlogPostSourceDto(
    int Id,
    string Title,
    string? Author,
    int? Year,
    string Type,
    string? Url,
    string? Note);

public record BlogPostDetailDto(
    int Id,
    string Slug,
    string Title,
    string Excerpt,
    string Body,
    string? HeroImageUrl,
    DateTime? PublishedAt,
    bool IsFeatured,
    string? Origin,
    DateTime? VerifiedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "blog";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();

    public AreaReferenceDto? Area { get; init; }

    public string? TimePerspective { get; init; }

    public IReadOnlyList<TagDto> Tags { get; init; } = Array.Empty<TagDto>();

    public IReadOnlyList<BlogPostSourceDto> Sources { get; init; } = Array.Empty<BlogPostSourceDto>();

    public string? EditorialStatus { get; init; }

    public string RowVersion { get; init; } = string.Empty;

    public bool CanEdit { get; init; }

    public bool CanSubmit { get; init; }

    public string? LatestModerationComment { get; init; }

    public string? LatestModerationAction { get; init; }
}

public record UpsertBlogPostSourceRequest(
    string Title,
    string? Author,
    int? Year,
    string Type,
    string? Url,
    string? Note);

public record UpsertBlogPostRequest(
    string Title,
    string Excerpt,
    string Body,
    string? HeroImageUrl,
    DateTime? PublishedAt,
    bool IsFeatured,
    string? Origin,
    string? Slug,
    int? AreaId = null,
    string? TimePerspective = null,
    IReadOnlyList<int>? TagIds = null,
    IReadOnlyList<UpsertBlogPostSourceRequest>? Sources = null,
    string? RowVersion = null,
    IReadOnlyList<TranslationEdit>? Translations = null,
    InlineImageUpload? ImageUpload = null);
