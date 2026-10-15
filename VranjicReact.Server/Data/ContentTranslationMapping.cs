using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Data;

internal static class ContentTranslationMapping
{
    public static void Configure<T>(ModelBuilder builder, string table) where T : class, ITranslatedEntity
    {
        var fields = ContentTranslationSchema.Fields(typeof(T));
        builder.Entity<T>().OwnsMany(entity => entity.Translations, translation =>
        {
            translation.ToTable(table);
            translation.WithOwner().HasForeignKey("ContentId");
            translation.HasKey("ContentId", nameof(ContentTranslation.Language));
            translation.Property(t => t.Language).HasMaxLength(16);
            translation.Property(t => t.SourceHash).HasMaxLength(64);
            translation.Property(t => t.Version).IsConcurrencyToken();
            foreach (var field in new ContentTranslation().GetFields().Keys)
            {
                if (fields.TryGetValue(field, out var length))
                    translation.Property<string>(ContentTranslationSchema.PropertyName(field)).HasMaxLength(length);
                else translation.Ignore(ContentTranslationSchema.PropertyName(field));
            }
        });
        // Editors explicitly load translations before writes; API DTOs use a separate batched projection.
        builder.Entity<T>().Navigation(entity => entity.Translations).AutoInclude(false);
    }
}
