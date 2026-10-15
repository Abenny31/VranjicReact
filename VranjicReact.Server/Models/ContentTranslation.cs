namespace VranjicReact.Server.Models;

public interface ITranslatedEntity
{
    int Id { get; }
    ICollection<ContentTranslation> Translations { get; set; }
}

// Each owner maps this owned type to its own table, with only its text columns.
public sealed class ContentTranslation
{
    public string Language { get; set; } = string.Empty;
    public string SourceHash { get; set; } = string.Empty;
    public bool IsStale { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? Title { get; set; }
    public string? Excerpt { get; set; }
    public string? Body { get; set; }
    public string? Summary { get; set; }
    public string? ActionLabel { get; set; }
    public string? Description { get; set; }
    public string? Name { get; set; }
    public string? ShortDescription { get; set; }

    public Dictionary<string, string?> GetFields() => new()
    {
        ["title"] = Title, ["excerpt"] = Excerpt, ["body"] = Body,
        ["summary"] = Summary, ["actionLabel"] = ActionLabel,
        ["description"] = Description, ["name"] = Name, ["shortDescription"] = ShortDescription,
    };

    public void SetFields(IReadOnlyDictionary<string, string?> fields)
    {
        Title = fields.GetValueOrDefault("title");
        Excerpt = fields.GetValueOrDefault("excerpt");
        Body = fields.GetValueOrDefault("body");
        Summary = fields.GetValueOrDefault("summary");
        ActionLabel = fields.GetValueOrDefault("actionLabel");
        Description = fields.GetValueOrDefault("description");
        Name = fields.GetValueOrDefault("name");
        ShortDescription = fields.GetValueOrDefault("shortDescription");
    }
}
