using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public sealed class ContentTranslationException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public static partial class ContentTranslationService
{
    [GeneratedRegex("^[a-z]{2,3}(-[a-z0-9]{2,8})?$", RegexOptions.CultureInvariant)]
    private static partial Regex LanguagePattern();

    public static async Task ApplyAsync(VranjicContext db, ITranslatedEntity entity,
        IReadOnlyList<TranslationEdit>? edits, CancellationToken ct)
    {
        if (edits is null || edits.Count == 0) return;
        if (edits.Count > 20) throw new ContentTranslationException(400, "Najviše 20 jezika po spremanju.");
        var fields = ContentTranslationSchema.Fields(entity.GetType());
        var languages = new HashSet<string>();
        foreach (var edit in edits)
        {
            if (edit is null || string.IsNullOrWhiteSpace(edit.Language) || edit.Language == "hr"
                || !LanguagePattern().IsMatch(edit.Language) || !languages.Add(edit.Language))
                throw new ContentTranslationException(400, "Neispravna ili ponovljena oznaka jezika prijevoda.");
            if (edit.Delete) continue;
            if (edit.Fields is null || edit.Source is null
                || !fields.Keys.ToHashSet().SetEquals(edit.Source.Keys)
                || edit.Fields.Keys.Any(key => !fields.ContainsKey(key))
                || edit.Fields.Any(pair => pair.Value?.Length > fields[pair.Key])
                || edit.Source.Any(pair => pair.Value?.Length > 100_000)
                || edit.Fields.Values.All(string.IsNullOrWhiteSpace))
                throw new ContentTranslationException(400, "Provjerite polja i duljinu prijevoda te hrvatski izvornik.");
        }

        await LoadAsync(db, entity, ct);
        foreach (var edit in edits)
        {
            var existing = entity.Translations.SingleOrDefault(t => t.Language == edit.Language);
            if (existing is not null && edit.Version != existing.Version
                || existing is null && edit.Version.HasValue)
                throw new ContentTranslationException(409, "Prijevod je u međuvremenu promijenjen. Osvježite podatke.");
            if (edit.Delete)
            {
                if (existing is not null) entity.Translations.Remove(existing);
                continue;
            }
            var translation = existing ?? new ContentTranslation { Language = edit.Language };
            translation.SetFields(edit.Fields!);
            translation.SourceHash = ContentTranslationSchema.Hash(edit.Source!);
            translation.IsStale = translation.SourceHash != ContentTranslationSchema.Hash(ContentTranslationSchema.Source(entity));
            translation.Version = Guid.NewGuid();
            translation.UpdatedAt = DateTime.UtcNow;
            if (existing is null) entity.Translations.Add(translation);
        }
    }

    internal static Task LoadAsync(VranjicContext db, ITranslatedEntity entity, CancellationToken ct)
    {
        if (db.Entry(entity).State == EntityState.Added
            || db.Entry(entity).Collection(nameof(ITranslatedEntity.Translations)).IsLoaded) return Task.CompletedTask;
        // Owned rows must be loaded with their owner in a tracking query. EF relationship
        // fix-up populates the existing owner without overwriting its pending HR edits.
        return entity switch
        {
            News => LoadOwnerAsync<News>(db, entity.Id, ct),
            BlogPost => LoadOwnerAsync<BlogPost>(db, entity.Id, ct),
            Announcement => LoadOwnerAsync<Announcement>(db, entity.Id, ct),
            GalleryAlbum => LoadOwnerAsync<GalleryAlbum>(db, entity.Id, ct),
            GalleryImage => LoadOwnerAsync<GalleryImage>(db, entity.Id, ct),
            Area => LoadOwnerAsync<Area>(db, entity.Id, ct),
            Tag => LoadOwnerAsync<Tag>(db, entity.Id, ct),
            _ => throw new ArgumentException("Unsupported content type.", nameof(entity)),
        };
    }

    private static Task LoadOwnerAsync<T>(VranjicContext db, int id, CancellationToken ct) where T : class, ITranslatedEntity =>
        db.Set<T>().Where(entity => entity.Id == id).Include(entity => entity.Translations).LoadAsync(ct);
}
