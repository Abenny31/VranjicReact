namespace VranjicReact.Server.Contracts;

public record AreaReferenceDto(int Id, string Name, string Slug) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "area";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();
    }

public record AreaDto(
    int Id,
    string Name,
    string Slug,
    string? ShortDescription,
    string? Description,
    string? CoverImageUrl,
    int SortOrder,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "area";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();
    }

public record UpsertAreaRequest(
    string Name,
    string? Slug,
    string? ShortDescription,
    string? Description,
    string? CoverImageUrl,
    int SortOrder,
    bool IsActive,
    IReadOnlyList<TranslationEdit>? Translations = null);

public record TagDto(int Id, string Name, string Slug, bool IsActive) : ITranslatedDto
    {
        string ITranslatedDto.TranslationKind => "tag";
        public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();
    }

public record UpsertTagRequest(string Name, string? Slug, bool IsActive,
    IReadOnlyList<TranslationEdit>? Translations = null);
