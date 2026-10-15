namespace VranjicReact.Server.Contracts;

public interface ITranslatedDto
{
    int Id { get; }
    string TranslationKind { get; }
    IReadOnlyList<ContentTranslationDto> Translations { get; set; }
}

public record ContentTranslationDto(string Language, Dictionary<string, string?> Fields,
    bool IsStale, Guid Version);

// Null/omitted edits preserve existing translations; deleting a language must be explicit.
public record TranslationEdit(string Language, Dictionary<string, string?>? Fields = null,
    Dictionary<string, string?>? Source = null, Guid? Version = null, bool Delete = false);

public record NewsReferenceDto(int Id, string Title) : ITranslatedDto
{
    string ITranslatedDto.TranslationKind => "news";
    public IReadOnlyList<ContentTranslationDto> Translations { get; set; } = Array.Empty<ContentTranslationDto>();
}
