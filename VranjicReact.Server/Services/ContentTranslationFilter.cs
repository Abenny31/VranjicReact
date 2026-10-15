using System.Collections;
using System.Linq.Expressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

// Enrich only DTOs already selected by the controller's visibility/authorization rules.
// One batch query per content kind avoids repeating translation queries for every list row.
public sealed class ContentTranslationFilter(VranjicContext db) : IAsyncResultFilter, IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is ContentTranslationException error)
        {
            context.Result = new ObjectResult(new { message = error.Message }) { StatusCode = error.Status };
            context.ExceptionHandled = true;
        }
        else if (context.Exception is DbUpdateConcurrencyException)
        {
            context.Result = new ConflictObjectResult(new { message = EditorialWorkflowService.ConcurrencyMessage });
            context.ExceptionHandled = true;
        }
    }

    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        if (context.Result is ObjectResult result && result.StatusCode is null or >= 200 and < 300)
        {
            var dtos = Walk(result.Value).ToList();
            foreach (var group in dtos.GroupBy(dto => dto.TranslationKind))
            {
                var ids = group.Select(dto => dto.Id).Distinct().ToArray();
                var fields = group.SelectMany(dto => dto.GetType().GetProperties().Select(property => property.Name)).ToHashSet();
                if (group.Any(dto => dto is UpdateSummaryDto { ContentType: "News" })) fields.Add(nameof(ContentTranslation.Excerpt));
                var rows = group.Key switch
                {
                    "news" => await LoadAsync<News>(ids, fields, context.HttpContext.RequestAborted),
                    "blog" => await LoadAsync<BlogPost>(ids, fields, context.HttpContext.RequestAborted),
                    "announcement" => await LoadAsync<Announcement>(ids, fields, context.HttpContext.RequestAborted),
                    "gallery" => await LoadAsync<GalleryAlbum>(ids, fields, context.HttpContext.RequestAborted),
                    "image" => await LoadAsync<GalleryImage>(ids, fields, context.HttpContext.RequestAborted),
                    "area" => await LoadAsync<Area>(ids, fields, context.HttpContext.RequestAborted),
                    "tag" => await LoadAsync<Tag>(ids, fields, context.HttpContext.RequestAborted),
                    _ => [],
                };
                var lookup = rows.ToLookup(row => row.Id);
                foreach (var dto in group)
                {
                    dto.Translations = lookup[dto.Id]
                        .Where(row => !row.Translation.IsStale || context.HttpContext.User.Identity?.IsAuthenticated == true)
                        .Select(row => ToDto(row.Translation, dto)).ToArray();
                }
            }
        }
        await next();
    }

    private Task<List<TranslationRow>> LoadAsync<T>(int[] ids, HashSet<string> requestedFields, CancellationToken ct) where T : class, ITranslatedEntity
    {
        // Build the projection from the known schema so a summary query never loads Body,
        // and a type without Body never references an unmapped column.
        var owner = Expression.Parameter(typeof(T), "owner");
        var translation = Expression.Parameter(typeof(ContentTranslation), "translation");
        var properties = ContentTranslationSchema.Fields(typeof(T)).Keys.Select(ContentTranslationSchema.PropertyName)
            .Where(requestedFields.Contains)
            .Concat([nameof(ContentTranslation.Language), nameof(ContentTranslation.IsStale), nameof(ContentTranslation.Version)]);
        var bindings = properties.Select(name => Expression.Bind(
            typeof(ContentTranslation).GetProperty(name) ?? throw new InvalidOperationException("Unknown translation property."),
            Expression.Property(translation, name)));
        var projectedTranslation = Expression.MemberInit(Expression.New(typeof(ContentTranslation)), bindings);
        var constructor = typeof(TranslationRow).GetConstructor([typeof(int), typeof(ContentTranslation)])
            ?? throw new InvalidOperationException("Translation row constructor not found.");
        var projection = Expression.Lambda<Func<T, ContentTranslation, TranslationRow>>(
            Expression.New(constructor, Expression.Property(owner, nameof(ITranslatedEntity.Id)), projectedTranslation), owner, translation);
        return db.Set<T>().AsNoTracking().Where(entity => ids.Contains(entity.Id))
            .SelectMany(entity => entity.Translations, projection).ToListAsync(ct);
    }

    private static ContentTranslationDto ToDto(ContentTranslation translation, ITranslatedDto dto)
    {
        // Summary DTOs must not gain full article bodies through translation metadata.
        var properties = dto.GetType().GetProperties().Select(property => property.Name).ToHashSet();
        var fields = translation.GetFields()
            .Where(pair => properties.Contains(ContentTranslationSchema.PropertyName(pair.Key)))
            .ToDictionary(pair => pair.Key, pair => pair.Value);
        if (dto is UpdateSummaryDto update && update.ContentType == "News")
            fields["summary"] = translation.Excerpt;
        return new(translation.Language, fields, translation.IsStale, translation.Version);
    }

    private static IEnumerable<ITranslatedDto> Walk(object? value)
    {
        if (value is UpdateSummaryDto { AreaId: int areaId, AreaName: not null, AreaSlug: not null } updateRow)
            updateRow.Area = new AreaReferenceDto(areaId, updateRow.AreaName, updateRow.AreaSlug);
        if (value is GalleryAlbumSummaryDto { RelatedNewsId: int newsId, RelatedNewsTitle: not null } galleryRow)
            galleryRow.RelatedNews = new NewsReferenceDto(newsId, galleryRow.RelatedNewsTitle);
        if (value is ITranslatedDto translated) yield return translated;
        IEnumerable<object?> children = value switch
        {
            HomeResponse home => [home.LatestNews, home.GalleryHighlights, home.Areas, home.ImportantAnnouncements, home.LatestBlogPosts],
            NewsDetailDto news => [news.Area, news.Tags],
            NewsSummaryDto news => [news.Area],
            BlogPostDetailDto blog => [blog.Area, blog.Tags],
            BlogPostSummaryDto blog => [blog.Area],
            AnnouncementDetailDto announcement => [announcement.Area, announcement.Tags],
            AnnouncementSummaryDto announcement => [announcement.Area],
            GalleryAlbumSummaryDto album => [album.Area, album.Tags, album.CoverImage, album.RelatedNews],
            GalleryAlbumDetailDto album => [album.Album, album.Images],
            UpdatesPageDto updates => [updates.Items],
            UpdateSummaryDto update => [update.Area],
            IEnumerable list when value is not string => list.Cast<object?>(),
            _ => [],
        };
        foreach (var child in children)
            foreach (var nested in Walk(child)) yield return nested;
    }

    private sealed record TranslationRow(int Id, ContentTranslation Translation);
}
