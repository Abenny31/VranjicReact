namespace VranjicReact.Server.Contracts
{
    public record GalleryItemDto(
        int Id,
        int AlbumId,
        string Title,
        string? Description,
        string MediaType,
        string? ContentType,
        string? FileName,
        long Size,
        bool IsFeatured,
        DateTime UploadedAt,
        bool CanEdit,
        bool CanDelete) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "image";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();
    }

    public record GalleryAlbumSummaryDto(
        int Id,
        string Title,
        string? Description,
        int ImageCount,
        GalleryItemDto? CoverImage,
        int? RelatedNewsId,
        string? RelatedNewsTitle,
        string? RelatedNewsSlug) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "gallery";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();

        public DateTime? CreatedAt { get; init; }
        public NewsReferenceDto? RelatedNews { get; set; }
        public DateOnly? EventDate { get; init; }
        public string? Photographer { get; init; }
        public DateTime? PublishedAt { get; init; }
        public string? EditorialStatus { get; init; }
        public string RowVersion { get; init; } = string.Empty;
        public bool CanEdit { get; init; }
        public bool CanSubmit { get; init; }
        public bool CanViewHistory { get; init; }

        public AreaReferenceDto? Area { get; init; }

        public string? TimePerspective { get; init; }

        public IReadOnlyList<TagDto> Tags { get; init; } = Array.Empty<TagDto>();
    }

    public record GalleryAlbumDetailDto(
        GalleryAlbumSummaryDto Album,
        IReadOnlyList<GalleryItemDto> Images);

    public record CreateGalleryItemRequest(
        string Title,
        string? Description,
        string MediaType,
        string? ContentType,
        string? FileName,
        string Base64Data,
        bool IsFeatured,
        int AlbumId,
    IReadOnlyList<TranslationEdit>? Translations = null);

    public record UpdateGalleryItemRequest(
        string Title,
        string? Description,
        bool IsFeatured,
    IReadOnlyList<TranslationEdit>? Translations = null);

    public record CreateGalleryAlbumRequest(
        string Title,
        string? Description,
        int? RelatedNewsId,
        int? AreaId = null,
        string? TimePerspective = null,
        IReadOnlyList<int>? TagIds = null,
        DateOnly? EventDate = null,
        string? Photographer = null,
        string? RowVersion = null,
    IReadOnlyList<TranslationEdit>? Translations = null,
        InlineImageUpload? ImageUpload = null);
}
