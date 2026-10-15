namespace VranjicReact.Server.Contracts
{
    public record NewsSummaryDto(
        int Id,
        string Slug,
        string Title,
        string Excerpt,
        DateTime? PublishedAt,
        bool IsFeatured,
        string? HeroImageUrl,
        int? GalleryAlbumId,
        int? GalleryImageId) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "news";
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

    public record NewsDetailDto(
        int Id,
        string Slug,
        string Title,
        string Excerpt,
        string Body,
        DateTime? PublishedAt,
        bool IsFeatured,
        string? HeroImageUrl,
        DateTime CreatedAt,
        DateTime? UpdatedAt,
        string? Source,
        int? GalleryAlbumId,
        int? GalleryImageId) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "news";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();

        public AreaReferenceDto? Area { get; init; }

        public string? TimePerspective { get; init; }

        public IReadOnlyList<TagDto> Tags { get; init; } = Array.Empty<TagDto>();

        public string? EditorialStatus { get; init; }

        public string RowVersion { get; init; } = string.Empty;

        public bool CanEdit { get; init; }

        public bool CanSubmit { get; init; }

        public string? LatestModerationComment { get; init; }

        public string? LatestModerationAction { get; init; }
    }

    public record UpsertNewsRequest(
        string Title,
        string Excerpt,
        string Body,
        DateTime? PublishedAt,
        bool IsFeatured,
        string? HeroImageUrl,
        string? Source,
        string? Slug,
        int? GalleryAlbumId,
        int? GalleryImageId,
        int? AreaId = null,
        string? TimePerspective = null,
        IReadOnlyList<int>? TagIds = null,
        string? RowVersion = null,
    IReadOnlyList<TranslationEdit>? Translations = null,
    InlineImageUpload? ImageUpload = null);
}
