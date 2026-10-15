namespace VranjicReact.Server.Configuration;

public sealed class PublicDisplayOptions
{
    public const string SectionName = "PublicDisplay";
    public int InitialAreaCount { get; set; } = 5;
    public Dictionary<string, string[]> AreaTagSlugs { get; set; } = new();
    public Dictionary<string, string[]> ContentTagSlugs { get; set; } = new();
    public bool IsValid() => InitialAreaCount is >= 1 and <= 50
        && ValidMap(AreaTagSlugs) && ValidMap(ContentTagSlugs)
        && ContentTagSlugs.Keys.All(key => key is "prica" or "obavijest" or "vremenska-obavijest" or "galerija");

    private static bool ValidMap(Dictionary<string, string[]>? map) => map is { Count: <= 200 }
        && map.All(entry => ValidSlug(entry.Key) && entry.Value is { Length: <= 20 } && entry.Value.All(ValidSlug));

    private static bool ValidSlug(string value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 128
        && value.All(character => char.IsAsciiLetterOrDigit(character) || character == '-');
}
