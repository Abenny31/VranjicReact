using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public static class ContentTranslationSchema
{
    public static IReadOnlyDictionary<string, int> Fields(Type type) => type.Name switch
    {
        nameof(News) or nameof(BlogPost) => new Dictionary<string, int> { ["title"] = 200, ["excerpt"] = 512, ["body"] = 100_000 },
        nameof(Announcement) => new Dictionary<string, int> { ["title"] = 200, ["summary"] = 512, ["body"] = 100_000, ["actionLabel"] = 100 },
        nameof(GalleryAlbum) or nameof(GalleryImage) => new Dictionary<string, int> { ["title"] = 200, ["description"] = 512 },
        nameof(Area) => new Dictionary<string, int> { ["name"] = 128, ["shortDescription"] = 512, ["description"] = 100_000 },
        nameof(Tag) => new Dictionary<string, int> { ["name"] = 100 },
        _ => throw new ArgumentException("Unsupported content type.", nameof(type)),
    };

    public static Dictionary<string, string?> Source(ITranslatedEntity entity) => entity switch
    {
        News n => new() { ["title"] = n.Title, ["excerpt"] = n.Excerpt, ["body"] = n.Body },
        BlogPost b => new() { ["title"] = b.Title, ["excerpt"] = b.Excerpt, ["body"] = b.Body },
        Announcement a => new() { ["title"] = a.Title, ["summary"] = a.Summary, ["body"] = a.Body, ["actionLabel"] = a.ActionLabel },
        GalleryAlbum a => new() { ["title"] = a.Title, ["description"] = a.Description },
        GalleryImage i => new() { ["title"] = i.Title, ["description"] = i.Description },
        Area a => new() { ["name"] = a.Name, ["shortDescription"] = a.ShortDescription, ["description"] = a.Description },
        Tag t => new() { ["name"] = t.Name },
        _ => throw new ArgumentException("Unsupported content type.", nameof(entity)),
    };

    public static string Hash(IReadOnlyDictionary<string, string?> source) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(
            source.OrderBy(pair => pair.Key, StringComparer.Ordinal)
                .ToDictionary(pair => pair.Key, pair => pair.Value?.Trim() ?? string.Empty)))));

    public static string PropertyName(string field) => char.ToUpperInvariant(field[0]) + field[1..];
}
