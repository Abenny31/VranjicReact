using System.Collections.Generic;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NewsController : ControllerBase
    {
        private readonly VranjicContext _db;
        private readonly ILogger<NewsController> _logger;
        private readonly ContentClassificationService _classification;
        private readonly AreaModerationService _moderation;
        private readonly EditorialWorkflowService _workflow;
        private readonly ContentImageService _images;

        public NewsController(
            VranjicContext db,
            ILogger<NewsController> logger,
            ContentClassificationService classification,
            AreaModerationService moderation,
            EditorialWorkflowService workflow,
            ContentImageService images)
        {
            _db = db;
            _logger = logger;
            _classification = classification;
            _moderation = moderation;
            _workflow = workflow;
            _images = images;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<NewsSummaryDto>>> GetAll(
            [FromQuery] int? limit,
            [FromQuery] bool includeUnpublished,
            [FromQuery] string? area,
            [FromQuery] string? perspective,
            [FromQuery] int? tagId,
            [FromQuery] string? search,
            [FromQuery] bool unlinkedOnly,
            [FromQuery] int page = 1,
            CancellationToken ct = default)
        {
            if (!ListPagination.IsValidPage(page)) return BadRequest("Neispravna stranica.");
            if (search?.Length > 200) return BadRequest("Pretraga može imati najviše 200 znakova.");
            var utcNow = DateTime.UtcNow;
            var includeEditorialInfo = includeUnpublished && User.Identity?.IsAuthenticated == true;
            var canManageContent = _moderation.IsContentManager(User);
            IQueryable<News> baseQuery = _db.News.AsNoTracking();

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (includeUnpublished && _moderation.IsContentManager(User))
            {
                // Content managers can inspect the complete editorial collection.
            }
            else if (includeUnpublished && !string.IsNullOrWhiteSpace(userId))
            {
                baseQuery = baseQuery.Where(n =>
                    (n.PublishedAt.HasValue && n.PublishedAt <= utcNow && n.EditorialStatus != EditorialStatus.Archived)
                    || n.CreatedByUserId == userId);
            }
            else
            {
                baseQuery = baseQuery.Where(n =>
                    n.PublishedAt.HasValue
                    && n.PublishedAt <= utcNow
                    && n.EditorialStatus != EditorialStatus.Archived);
            }

            if (!string.IsNullOrWhiteSpace(area))
            {
                var areaSlug = area.Trim().ToLowerInvariant();
                baseQuery = baseQuery.Where(n => n.Area != null && n.Area.IsActive && n.Area.Slug == areaSlug);
            }

            if (!string.IsNullOrWhiteSpace(perspective))
            {
                var requestedPerspective = perspective.Trim();
                if (!Enum.GetNames<ContentTimePerspective>().Contains(requestedPerspective, StringComparer.OrdinalIgnoreCase)
                    || !Enum.TryParse<ContentTimePerspective>(requestedPerspective, true, out var parsedPerspective))
                {
                    return BadRequest("Vremenska perspektiva mora biti Jucer, Danas ili Sutra.");
                }

                baseQuery = baseQuery.Where(n => n.TimePerspective == parsedPerspective);
            }

            if (tagId is > 0)
            {
                baseQuery = baseQuery.Where(n => n.NewsTags.Any(link => link.TagId == tagId));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                baseQuery = baseQuery.Where(n => n.Title.Contains(term));
            }
            if (unlinkedOnly) baseQuery = baseQuery.Where(n => n.GalleryAlbumId == null);
            baseQuery = baseQuery
                .OrderByDescending(n => n.PublishedAt ?? n.CreatedAt)
                .ThenByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id);

            var take = limit is > 0 ? Math.Min(limit.Value, 200) : 100;
            var finalQuery = baseQuery.Skip((page - 1) * take).Take(take + 1);

            var projections = await finalQuery
                .Select(n => new
                {
                    n.Id,
                    n.Slug,
                    n.Title,
                    n.Excerpt,
                    n.PublishedAt,
                    n.IsFeatured,
                    n.HeroImageUrl,
                    n.GalleryAlbumId,
                    n.GalleryImageId,
                    n.TimePerspective,
                    n.EditorialStatus,
                    n.RowVersion,
                    n.CreatedByUserId,
                    LatestModerationComment = n.ModerationActions
                        .OrderByDescending(action => action.CreatedAt)
                        .ThenByDescending(action => action.Id)
                        .Select(action => action.Comment)
                        .FirstOrDefault(),
                    LatestModerationAction = n.ModerationActions
                        .OrderByDescending(action => action.CreatedAt)
                        .ThenByDescending(action => action.Id)
                        .Select(action => (ModerationActionType?)action.Action)
                        .FirstOrDefault(),
                    Area = n.Area == null
                        ? null
                        : new AreaReferenceDto(n.Area.Id, n.Area.Name, n.Area.Slug),
                })
                .ToListAsync(ct);

            ListPagination.Complete(Response, projections, take);
            var albumIds = projections
                .Select(p => p.GalleryAlbumId)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            var coverLookup = new Dictionary<int, int>();

            if (albumIds.Count > 0)
            {
                var covers = await _db.GalleryImages
                    .AsNoTracking()
                    .Where(image => albumIds.Contains(image.AlbumId))
                    .GroupBy(image => image.AlbumId)
                    .Select(group => group
                        .OrderByDescending(image => image.IsFeatured)
                        .ThenByDescending(image => image.UploadedAt)
                        .FirstOrDefault())
                    .ToListAsync(ct);

                coverLookup = covers
                    .Where(image => image is not null)
                    .Cast<GalleryImage>()
                    .ToDictionary(image => image.AlbumId, image => image.Id);
            }

            var items = projections
                .Select(item =>
                {
                    var hero = string.IsNullOrWhiteSpace(item.HeroImageUrl)
                        ? (item.GalleryImageId is int imageId
                            ? $"/api/gallery/{imageId}/media"
                            : (item.GalleryAlbumId is int albumId && coverLookup.TryGetValue(albumId, out var coverId)
                                ? $"/api/gallery/{coverId}/media"
                                : null))
                        : item.HeroImageUrl;

                    return new NewsSummaryDto(
                        item.Id,
                        item.Slug,
                        item.Title,
                        item.Excerpt,
                        item.PublishedAt,
                        item.IsFeatured,
                        hero,
                        item.GalleryAlbumId,
                        item.GalleryImageId)
                    {
                        Area = item.Area,
                        TimePerspective = item.TimePerspective == null ? null : item.TimePerspective.ToString(),
                        EditorialStatus = item.EditorialStatus?.ToString(),
                        RowVersion = Convert.ToBase64String(item.RowVersion),
                        CanEdit = _moderation.CanEdit(User, item.CreatedByUserId, item.EditorialStatus),
                        CanSubmit = _moderation.CanEdit(User, item.CreatedByUserId, item.EditorialStatus)
                            && CanSubmit(item.EditorialStatus),
                        LatestModerationComment = includeEditorialInfo && (canManageContent || item.CreatedByUserId == userId) ? item.LatestModerationComment : null,
                        LatestModerationAction = includeEditorialInfo && (canManageContent || item.CreatedByUserId == userId) ? item.LatestModerationAction?.ToString() : null,
                    };
                })
                .ToList();

            return Ok(items);
        }

        [HttpGet("{slugOrId}")]
        public async Task<ActionResult<NewsDetailDto>> GetOne(string slugOrId, [FromQuery] bool includeUnpublished, CancellationToken ct)
        {
            var query = _db.News
                .AsNoTracking()
                .Include(news => news.Area)
                .Include(news => news.NewsTags)
                    .ThenInclude(link => link.Tag)
                .Include(news => news.ModerationActions);

            News? entity;

            if (int.TryParse(slugOrId, out var id))
            {
                entity = await query.FirstOrDefaultAsync(news => news.Id == id, ct);
            }
            else
            {
                entity = await query.FirstOrDefaultAsync(news => news.Slug == slugOrId, ct);
            }

            if (entity is null)
            {
                return NotFound();
            }

            if (!CanViewNews(entity, includeUnpublished)
                && !(includeUnpublished
                    && await _moderation.CanModerateAsync(User, entity.CreatedByUserId, entity.AreaId, ct)))
            {
                return NotFound();
            }

            var hero = entity.HeroImageUrl;

            if (string.IsNullOrWhiteSpace(hero))
            {
                if (entity.GalleryImageId is int imageId)
                {
                    hero = $"/api/gallery/{imageId}/media";
                }
                else if (entity.GalleryAlbumId is int albumId)
                {
                    var cover = await _db.GalleryImages
                        .AsNoTracking()
                        .Where(image => image.AlbumId == albumId)
                        .OrderByDescending(image => image.IsFeatured)
                        .ThenByDescending(image => image.UploadedAt)
                        .FirstOrDefaultAsync(ct);

                    if (cover is not null)
                    {
                        hero = $"/api/gallery/{cover.Id}/media";
                    }
                }
            }

            return Ok(ToDetailDto(entity, hero, includeUnpublished && await _workflow.CanPreviewAsync(User, entity, ct)));
        }

        [HttpPost]
        [Authorize(Policy = PolicyNames.ContentCreate)]
        public async Task<ActionResult<NewsDetailDto>> Create(UpsertNewsRequest request, CancellationToken ct)
        {
            var imageError = ContentImageService.Validate(request.ImageUpload, out var imageUpload);
            if (imageError is not null) return BadRequest(imageError);
            if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Excerpt) || string.IsNullOrWhiteSpace(request.Body))
            {
                return BadRequest("Title, excerpt and body are required.");
            }

            int? galleryAlbumId = request.GalleryAlbumId;
            int? galleryImageId = request.GalleryImageId;
            GalleryImage? selectedImage = null;

            if (galleryImageId is int imageId)
            {
                selectedImage = await _db.GalleryImages.AsNoTracking().FirstOrDefaultAsync(i => i.Id == imageId, ct);
                if (selectedImage is null)
                {
                    return BadRequest("Odabrana slika ne postoji.");
                }

                if (galleryAlbumId is int providedAlbumId && providedAlbumId != selectedImage.AlbumId)
                {
                    return BadRequest("Odabrana slika ne pripada odabranom albumu.");
                }

                galleryAlbumId ??= selectedImage.AlbumId;
            }

            if (galleryAlbumId is int albumId)
            {
                var albumExists = await _db.GalleryAlbums.AnyAsync(a => a.Id == albumId, ct);
                if (!albumExists)
                {
                    return BadRequest("Odabrani album ne postoji.");
                }
            }

            var classification = await _classification.ResolveAsync(
                request.AreaId,
                request.TimePerspective,
                request.TagIds,
                ct);

            if (!classification.IsValid)
            {
                return BadRequest(classification.ValidationError);
            }

            var slugFromRequest = string.IsNullOrWhiteSpace(request.Slug) ? request.Title : request.Slug;
            var generatedSlug = SlugHelper.GenerateSlug(slugFromRequest);
            var uniqueSlug = await EnsureUniqueSlugAsync(generatedSlug, null, ct);
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var utcNow = DateTime.UtcNow;

            var entity = new News
            {
                Title = request.Title.Trim(),
                Excerpt = request.Excerpt.Trim(),
                Body = request.Body,
                HeroImageUrl = request.HeroImageUrl,
                PublishedAt = _moderation.IsContentManager(User) ? request.PublishedAt?.ToUniversalTime() : null,
                CreatedAt = utcNow,
                UpdatedAt = utcNow,
                Slug = uniqueSlug,
                IsFeatured = _moderation.IsContentManager(User) && request.IsFeatured,
                Source = request.Source,
                CreatedByUserId = userId,
                GalleryAlbumId = galleryAlbumId,
                GalleryImageId = galleryImageId,
                AreaId = classification.Area?.Id,
                Area = classification.Area,
                TimePerspective = classification.TimePerspective,
                EditorialStatus = _moderation.IsContentManager(User) && request.PublishedAt.HasValue
                    ? EditorialStatus.Published
                    : EditorialStatus.Draft,
            };

            foreach (var tag in classification.Tags)
            {
                entity.NewsTags.Add(new NewsTag
                {
                    News = entity,
                    Tag = tag,
                    TagId = tag.Id,
                });
            }

            _db.News.Add(entity);
            _workflow.RecordPublication(entity, User);
            await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, ct);
            await _images.SaveAsync(entity, entity.Title, imageUpload, classification.Tags, User.FindFirstValue(ClaimTypes.NameIdentifier), ct);

            var hero = entity.HeroImageUrl;

            if (string.IsNullOrWhiteSpace(hero))
            {
                if (entity.GalleryImageId is int createdImageId)
                {
                    hero = $"/api/gallery/{createdImageId}/media";
                }
                else if (entity.GalleryAlbumId is int createdAlbumId)
                {
                    var cover = await _db.GalleryImages
                        .AsNoTracking()
                        .Where(image => image.AlbumId == createdAlbumId)
                        .OrderByDescending(image => image.IsFeatured)
                        .ThenByDescending(image => image.UploadedAt)
                        .FirstOrDefaultAsync(ct);

                    if (cover is not null)
                    {
                        hero = $"/api/gallery/{cover.Id}/media";
                    }
                }
            }

            return CreatedAtAction(nameof(GetOne), new { slugOrId = entity.Slug }, ToDetailDto(entity, hero, true));
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = PolicyNames.ContentCreate)]
        public async Task<ActionResult<NewsDetailDto>> Update(int id, UpsertNewsRequest request, CancellationToken ct)
        {
            var entity = await _db.News
                .Include(news => news.Area)
                .Include(news => news.NewsTags)
                    .ThenInclude(link => link.Tag)
                .FirstOrDefaultAsync(news => news.Id == id, ct);

            if (entity is null)
            {
                return NotFound();
            }

            if (!_moderation.CanEdit(User, entity.CreatedByUserId, entity.EditorialStatus))
            {
                return Forbid();
            }

            if (!MatchesRowVersion(entity.RowVersion, request.RowVersion))
            {
                return Conflict("Sadržaj je u međuvremenu promijenjen. Osvježite podatke i pokušajte ponovno.");
            }

            if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Excerpt) || string.IsNullOrWhiteSpace(request.Body))
            {
                return BadRequest("Title, excerpt and body are required.");
            }

            int? galleryAlbumId = request.GalleryAlbumId;
            int? galleryImageId = request.GalleryImageId;

            if (galleryImageId is int imageId)
            {
                var image = await _db.GalleryImages.AsNoTracking().FirstOrDefaultAsync(i => i.Id == imageId, ct);
                if (image is null)
                {
                    return BadRequest("Odabrana slika ne postoji.");
                }

                if (galleryAlbumId is int providedAlbumId && providedAlbumId != image.AlbumId)
                {
                    return BadRequest("Odabrana slika ne pripada odabranom albumu.");
                }

                galleryAlbumId ??= image.AlbumId;
            }

            if (galleryAlbumId is int albumId)
            {
                var albumExists = await _db.GalleryAlbums.AnyAsync(a => a.Id == albumId, ct);
                if (!albumExists)
                {
                    return BadRequest("Odabrani album ne postoji.");
                }
            }

            var imageError = ContentImageService.Validate(request.ImageUpload, out var imageUpload);
            if (imageError is not null) return BadRequest(imageError);
            var classification = await _classification.ResolveAsync(
                request.AreaId,
                request.TimePerspective,
                request.TagIds,
                ct);

            if (!classification.IsValid)
            {
                return BadRequest(classification.ValidationError);
            }

            var slugFromRequest = string.IsNullOrWhiteSpace(request.Slug) ? request.Title : request.Slug;
            var generatedSlug = SlugHelper.GenerateSlug(slugFromRequest);
            var uniqueSlug = await EnsureUniqueSlugAsync(generatedSlug, id, ct);

            entity.Title = request.Title.Trim();
            entity.Excerpt = request.Excerpt.Trim();
            entity.Body = request.Body;
            entity.HeroImageUrl = request.HeroImageUrl;
            entity.IsFeatured = _moderation.IsContentManager(User) && request.IsFeatured;
            entity.Source = request.Source;
            entity.Slug = uniqueSlug;
            entity.UpdatedAt = DateTime.UtcNow;
            entity.GalleryAlbumId = galleryAlbumId;
            entity.GalleryImageId = galleryImageId;
            entity.AreaId = classification.Area?.Id;
            entity.Area = classification.Area;
            entity.TimePerspective = classification.TimePerspective;

            _workflow.ResetAfterEdit(entity, User);

            var requestedTagIds = classification.Tags.Select(tag => tag.Id).ToHashSet();
            var removedLinks = entity.NewsTags
                .Where(link => !requestedTagIds.Contains(link.TagId))
                .ToList();
            _db.NewsTags.RemoveRange(removedLinks);
            foreach (var removedLink in removedLinks)
            {
                entity.NewsTags.Remove(removedLink);
            }

            var existingTagIds = entity.NewsTags.Select(link => link.TagId).ToHashSet();
            foreach (var tag in classification.Tags.Where(tag => !existingTagIds.Contains(tag.Id)))
            {
                entity.NewsTags.Add(new NewsTag
                {
                    News = entity,
                    Tag = tag,
                    TagId = tag.Id,
                });
            }
            await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, ct);
            try
            {
                await _images.SaveAsync(entity, entity.Title, imageUpload, classification.Tags, User.FindFirstValue(ClaimTypes.NameIdentifier), ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict("Sadržaj je u međuvremenu promijenjen. Osvježite podatke i pokušajte ponovno.");
            }

            var hero = entity.HeroImageUrl;

            if (string.IsNullOrWhiteSpace(hero))
            {
                if (entity.GalleryImageId is int updatedImageId)
                {
                    hero = $"/api/gallery/{updatedImageId}/media";
                }
                else if (entity.GalleryAlbumId is int updatedAlbumId)
                {
                    var cover = await _db.GalleryImages
                        .AsNoTracking()
                        .Where(image => image.AlbumId == updatedAlbumId)
                        .OrderByDescending(image => image.IsFeatured)
                        .ThenByDescending(image => image.UploadedAt)
                        .FirstOrDefaultAsync(ct);

                    if (cover is not null)
                    {
                        hero = $"/api/gallery/{cover.Id}/media";
                    }
                }
            }

            return Ok(ToDetailDto(entity, hero, true));
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = PolicyNames.ContentManage)]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var entity = await _db.News.FirstOrDefaultAsync(n => n.Id == id, ct);

            if (entity is null)
            {
                return NotFound();
            }

            if (await _db.ContentModerationActions.AnyAsync(action => action.NewsId == id, ct))
            {
                return Conflict("Sadržaj s poviješću moderiranja nije moguće trajno obrisati.");
            }

            _db.News.Remove(entity);
            await _db.SaveChangesAsync(ct);

            return NoContent();
        }

        private bool CanViewNews(News entity, bool includeUnpublished)
        {
            if (entity.PublishedAt.HasValue
                && entity.PublishedAt.Value <= DateTime.UtcNow
                && entity.EditorialStatus != EditorialStatus.Archived)
            {
                return true;
            }

            return includeUnpublished && User.Identity?.IsAuthenticated == true
                && (_moderation.IsContentManager(User)
                    || entity.CreatedByUserId == User.FindFirstValue(ClaimTypes.NameIdentifier));
        }

        private async Task<string> EnsureUniqueSlugAsync(string baseSlug, int? existingId, CancellationToken ct)
        {
            var slug = baseSlug;
            var suffix = 1;

            while (await _db.News.AnyAsync(n => n.Slug == slug && n.Id != existingId, ct))
            {
                slug = $"{baseSlug}-{suffix++}";
            }

            return slug;
        }

        private NewsDetailDto ToDetailDto(News entity, string? heroImageUrl, bool includeEditorialInfo) =>
            new(
                entity.Id,
                entity.Slug,
                entity.Title,
                entity.Excerpt,
                entity.Body,
                entity.PublishedAt,
                entity.IsFeatured,
                heroImageUrl,
                entity.CreatedAt,
                entity.UpdatedAt,
                entity.Source,
                entity.GalleryAlbumId,
                entity.GalleryImageId)
            {
                Area = entity.Area is null
                    ? null
                    : new AreaReferenceDto(entity.Area.Id, entity.Area.Name, entity.Area.Slug),
                TimePerspective = entity.TimePerspective?.ToString(),
                Tags = entity.NewsTags
                    .Select(link => new TagDto(link.Tag.Id, link.Tag.Name, link.Tag.Slug, link.Tag.IsActive))
                    .OrderBy(tag => tag.Name)
                    .ToList(),
                EditorialStatus = entity.EditorialStatus?.ToString(),
                RowVersion = Convert.ToBase64String(entity.RowVersion),
                CanEdit = _moderation.CanEdit(User, entity.CreatedByUserId, entity.EditorialStatus),
                CanSubmit = _moderation.CanEdit(User, entity.CreatedByUserId, entity.EditorialStatus)
                    && CanSubmit(entity.EditorialStatus),
                LatestModerationComment = includeEditorialInfo
                    ? entity.ModerationActions.OrderByDescending(action => action.CreatedAt).ThenByDescending(action => action.Id).FirstOrDefault()?.Comment
                    : null,
                LatestModerationAction = includeEditorialInfo
                    ? entity.ModerationActions.OrderByDescending(action => action.CreatedAt).ThenByDescending(action => action.Id).FirstOrDefault()?.Action.ToString()
                    : null,
            };

        private static bool CanSubmit(EditorialStatus? status) => status is
            EditorialStatus.Draft or EditorialStatus.ChangesRequested or EditorialStatus.Rejected;

        private static bool MatchesRowVersion(byte[] current, string? supplied)
        {
            if (string.IsNullOrWhiteSpace(supplied)) return false;
            try
            {
                return current.AsSpan().SequenceEqual(Convert.FromBase64String(supplied));
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
