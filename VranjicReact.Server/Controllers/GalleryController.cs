using System.Security.Claims;
using System.Linq.Expressions;
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
    public class GalleryController : ControllerBase
    {
        private readonly VranjicContext _db;
        private readonly ILogger<GalleryController> _logger;
        private readonly ContentClassificationService _classification;
        private readonly AreaModerationService _moderation;
        private readonly EditorialWorkflowService _workflow;
        private readonly ContentImageService _images;

        public GalleryController(
            VranjicContext db,
            ILogger<GalleryController> logger,
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
        public async Task<ActionResult<IEnumerable<GalleryItemDto>>> GetAll([FromQuery] GalleryItemListQuery options, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            var query = _db.GalleryImages.AsNoTracking()
                .Where(g => g.Album != null && g.Album.EditorialStatus == EditorialStatus.Published && g.Album.PublishedAt <= now);
            if (options.AlbumId is int albumId) query = query.Where(g => g.AlbumId == albumId);
            if (options.ImagesOnly) query = query.Where(g => g.MediaType == GalleryMediaType.Image);
            var search = options.Search?.Trim();
            if (!string.IsNullOrEmpty(search)) query = query.Where(g => g.Title.Contains(search));
            var items = await query
                .OrderByDescending(g => g.IsFeatured)
                .ThenByDescending(g => g.UploadedAt).ThenByDescending(g => g.Id)
                .Skip((options.Page - 1) * options.Limit).Take(options.Limit + 1)
                .Select(MetadataProjection)
                .ToListAsync(ct);

            ListPagination.Complete(Response, items, options.Limit);
            return Ok(items.Select(ToDto).ToList());
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<GalleryItemDto>> GetOne(int id, CancellationToken ct)
        {
            var entity = await _db.GalleryImages.AsNoTracking().Where(g => g.Id == id).Select(MetadataProjection).FirstOrDefaultAsync(ct);

            if (entity is null || !await CanViewAlbumAsync(entity.Album, ct))
            {
                return NotFound();
            }

            return Ok(ToDto(entity));
        }

        [HttpGet("{id:int}/media")]
        public async Task<IActionResult> GetMedia(int id, CancellationToken ct)
        {
            var entity = await _db.GalleryImages.AsNoTracking().Include(g => g.Album).FirstOrDefaultAsync(g => g.Id == id, ct);

            if (entity is null || !await CanViewAlbumAsync(entity.Album, ct))
            {
                return NotFound();
            }

            var contentType = string.IsNullOrWhiteSpace(entity.ContentType) ? "application/octet-stream" : entity.ContentType;
            var fileName = string.IsNullOrWhiteSpace(entity.FileName) ? $"gallery-{id}" : entity.FileName;

            Response.Headers.CacheControl = "private, no-store";
            Response.Headers.XContentTypeOptions = "nosniff";
            return File(entity.Data, contentType, fileName);
        }

        [HttpGet("albums")]
        public async Task<ActionResult<IEnumerable<GalleryAlbumSummaryDto>>> GetAlbums(
            [FromQuery] string? area,
            [FromQuery] string? perspective,
            [FromQuery] int? tagId,
            [FromQuery] int? year,
            [FromQuery] bool includeUnpublished,
            [FromQuery] bool editableOnly,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int limit = 200,
            CancellationToken ct = default)
        {
            if (!ListPagination.IsValidPage(page) || limit is < 1 or > 200) return BadRequest("Neispravna stranica ili veličina stranice.");
            if (year is < 1 or > 9999 || tagId is < 1) return BadRequest("Neispravna godina ili oznaka.");
            if (search?.Length > 200) return BadRequest("Pretraga može imati najviše 200 znakova.");
            IQueryable<GalleryAlbum> albumsQuery = _db.GalleryAlbums.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim();
                albumsQuery = albumsQuery.Where(album => album.Title.Contains(term));
            }
            var now = DateTime.UtcNow;
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var canManage = _moderation.IsContentManager(User);
            var isModerator = User.IsInRole(RoleNames.Moderator);
            if (!(includeUnpublished && _moderation.IsContentManager(User)))
                albumsQuery = albumsQuery.Where(a => (a.EditorialStatus == EditorialStatus.Published && a.PublishedAt <= now)
                    || (includeUnpublished && userId != null && a.CreatedByUserId == userId));

            if (editableOnly && !canManage)
                albumsQuery = albumsQuery.Where(a => userId != null && a.CreatedByUserId == userId
                    && (a.EditorialStatus == EditorialStatus.Draft || a.EditorialStatus == EditorialStatus.ChangesRequested
                        || a.EditorialStatus == EditorialStatus.Rejected));

            if (!string.IsNullOrWhiteSpace(area))
            {
                var areaSlug = area.Trim().ToLowerInvariant();
                albumsQuery = albumsQuery.Where(album =>
                    album.Area != null && album.Area.IsActive && album.Area.Slug == areaSlug);
            }

            if (!string.IsNullOrWhiteSpace(perspective))
            {
                var requestedPerspective = perspective.Trim();
                if (!Enum.GetNames<ContentTimePerspective>().Contains(requestedPerspective, StringComparer.OrdinalIgnoreCase)
                    || !Enum.TryParse<ContentTimePerspective>(requestedPerspective, true, out var parsedPerspective))
                {
                    return BadRequest("Vremenska perspektiva mora biti Jucer, Danas ili Sutra.");
                }

                albumsQuery = albumsQuery.Where(album => album.TimePerspective == parsedPerspective);
            }

            if (tagId is > 0)
            {
                albumsQuery = albumsQuery.Where(album => album.GalleryAlbumTags.Any(link => link.TagId == tagId));
            }

            if (year is > 0)
            {
                albumsQuery = albumsQuery.Where(album => album.EventDate.HasValue && album.EventDate.Value.Year == year);
            }

            var summaries = await albumsQuery
                .Select(album => new
                {
                    album.Id,
                    album.Title,
                    album.Description,
                    album.CreatedAt,
                    album.UpdatedAt,
                    album.EventDate,
                    album.Photographer,
                    album.PublishedAt,
                    album.EditorialStatus,
                    album.RowVersion,
                    album.CreatedByUserId,
                    CanViewHistory = userId != null && (canManage || album.CreatedByUserId == userId
                        || (isModerator && _db.AreaModeratorAssignments.Any(assignment => assignment.UserId == userId
                            && assignment.AreaId == album.AreaId && assignment.IsActive
                            && (!assignment.EndsAt.HasValue || assignment.EndsAt > now)))),
                    album.TimePerspective,
                    Area = album.Area == null
                        ? null
                        : new AreaReferenceDto(album.Area.Id, album.Area.Name, album.Area.Slug),
                    Tags = album.GalleryAlbumTags
                        .OrderBy(link => link.Tag.Name)
                        .Select(link => new TagDto(link.Tag.Id, link.Tag.Name, link.Tag.Slug, link.Tag.IsActive))
                        .ToList(),
                    ImageCount = _db.GalleryImages.Count(image => image.AlbumId == album.Id),
                    RelatedNews = _db.News
                        .Where(n => n.GalleryAlbumId == album.Id && ((includeUnpublished && canManage) || (n.EditorialStatus == EditorialStatus.Published && n.PublishedAt <= now)))
                        .Select(n => new
                        {
                            n.Id,
                            n.Title,
                            n.Slug,
                        })
                        .FirstOrDefault(),
                })
                .OrderByDescending(a => a.UpdatedAt ?? a.CreatedAt)
                .ThenBy(a => a.Title)
                .ThenBy(a => a.Id)
                .Skip((page - 1) * limit).Take(limit + 1)
                .ToListAsync(ct);

            ListPagination.Complete(Response, summaries, limit);
            var albumIds = summaries.Select(a => a.Id).ToList();

            var coverImages = await _db.GalleryImages
                .AsNoTracking()
                .Where(image => albumIds.Contains(image.AlbumId))
                .GroupBy(image => image.AlbumId)
                .Select(group => group
                    .OrderByDescending(image => image.IsFeatured)
                    .ThenByDescending(image => image.UploadedAt)
                    .ThenByDescending(image => image.Id)
                    .Select(image => new GalleryImage
                    {
                        Id = image.Id, AlbumId = image.AlbumId, Title = image.Title,
                        Description = image.Description, MediaType = image.MediaType, ContentType = image.ContentType,
                        FileName = image.FileName, Size = image.Size, IsFeatured = image.IsFeatured,
                        UploadedAt = image.UploadedAt, UploadedByUserId = image.UploadedByUserId,
                    })
                    .FirstOrDefault())
                .ToListAsync(ct);

            var coverLookup = coverImages
                .Where(image => image != null)
                .Cast<GalleryImage>()
                .ToDictionary(image => image.AlbumId, image => ToDto(image));

            var result = summaries
                .Select(summary =>
                    new GalleryAlbumSummaryDto(
                        summary.Id,
                        summary.Title,
                        summary.Description,
                        summary.ImageCount,
                        coverLookup.TryGetValue(summary.Id, out var cover) ? cover : null,
                        summary.RelatedNews?.Id,
                        summary.RelatedNews?.Title,
                        summary.RelatedNews?.Slug)
                    {
                        CreatedAt = summary.CreatedAt,
                        EventDate = summary.EventDate,
                        Photographer = summary.Photographer,
                        PublishedAt = summary.PublishedAt,
                        EditorialStatus = summary.EditorialStatus?.ToString(),
                        RowVersion = Convert.ToBase64String(summary.RowVersion),
                        CanEdit = _moderation.CanEdit(User, summary.CreatedByUserId, summary.EditorialStatus),
                        CanViewHistory = summary.CanViewHistory,
                        CanSubmit = _moderation.CanEdit(User, summary.CreatedByUserId, summary.EditorialStatus)
                            && EditorialWorkflowService.CanSubmit(summary.EditorialStatus),
                        Area = summary.Area,
                        TimePerspective = summary.TimePerspective?.ToString(),
                        Tags = summary.Tags,
                    })
                .ToList();

            return Ok(result);
        }

        [HttpGet("albums/{albumId:int}")]
        public async Task<ActionResult<GalleryAlbumDetailDto>> GetAlbum(int albumId, CancellationToken ct)
        {
            var album = await _db.GalleryAlbums.AsNoTracking().FirstOrDefaultAsync(a => a.Id == albumId, ct);
            if (album is null || !await CanViewAlbumAsync(album, ct)) return NotFound();
            var now = DateTime.UtcNow;
            var canManage = _moderation.IsContentManager(User);
            var albumSummary = await _db.GalleryAlbums
                .AsNoTracking()
                .Where(a => a.Id == albumId)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    a.Description,
                    a.CreatedAt,
                    a.UpdatedAt,
                    a.TimePerspective,
                    Area = a.Area == null
                        ? null
                        : new AreaReferenceDto(a.Area.Id, a.Area.Name, a.Area.Slug),
                    Tags = a.GalleryAlbumTags
                        .OrderBy(link => link.Tag.Name)
                        .Select(link => new TagDto(link.Tag.Id, link.Tag.Name, link.Tag.Slug, link.Tag.IsActive))
                        .ToList(),
                    ImageCount = _db.GalleryImages.Count(image => image.AlbumId == a.Id),
                    Cover = _db.GalleryImages
                        .Where(image => image.AlbumId == a.Id)
                        .OrderByDescending(image => image.IsFeatured)
                        .ThenByDescending(image => image.UploadedAt)
                        .FirstOrDefault(),
                    RelatedNews = _db.News
                        .Where(n => n.GalleryAlbumId == a.Id && (canManage || (n.EditorialStatus == EditorialStatus.Published && n.PublishedAt <= now)))
                        .Select(n => new
                        {
                            n.Id,
                            n.Title,
                            n.Slug,
                        })
                        .FirstOrDefault(),
                })
                .FirstOrDefaultAsync(ct);

            if (albumSummary is null)
            {
                return NotFound();
            }

            var images = await _db.GalleryImages
                .AsNoTracking()
                .Include(image => image.Album)
                .Where(image => image.AlbumId == albumId)
                .OrderByDescending(image => image.IsFeatured)
                .ThenByDescending(image => image.UploadedAt)
                .Select(MetadataProjection)
                .ToListAsync(ct);

            var summaryDto = new GalleryAlbumSummaryDto(
                albumSummary.Id,
                albumSummary.Title,
                albumSummary.Description,
                albumSummary.ImageCount,
                albumSummary.Cover is null ? null : ToDto(albumSummary.Cover),
                albumSummary.RelatedNews?.Id,
                albumSummary.RelatedNews?.Title,
                albumSummary.RelatedNews?.Slug)
            {
                CreatedAt = albumSummary.CreatedAt,
                EventDate = album.EventDate,
                Photographer = album.Photographer,
                PublishedAt = album.PublishedAt,
                EditorialStatus = album.EditorialStatus?.ToString(),
                RowVersion = Convert.ToBase64String(album.RowVersion),
                CanEdit = _moderation.CanEdit(User, album.CreatedByUserId, album.EditorialStatus),
                CanViewHistory = await _workflow.CanPreviewAsync(User, album, ct),
                CanSubmit = _moderation.CanEdit(User, album.CreatedByUserId, album.EditorialStatus)
                    && EditorialWorkflowService.CanSubmit(album.EditorialStatus),
                Area = albumSummary.Area,
                TimePerspective = albumSummary.TimePerspective?.ToString(),
                Tags = albumSummary.Tags,
            };

            var detail = new GalleryAlbumDetailDto(summaryDto, images.Select(ToDto).ToList());
            return Ok(detail);
        }

        [HttpPost("albums")]
        [Authorize(Policy = PolicyNames.ContentCreate)]
        public async Task<ActionResult<GalleryAlbumSummaryDto>> CreateAlbum(CreateGalleryAlbumRequest request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest("Title is required.");
            }

            var title = request.Title.Trim();
            if (title.Length > 200 || request.Description?.Length > 512 || request.Photographer?.Length > 200)
                return BadRequest("Naslov, opis ili ime fotografa su predugi.");
            var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            News? relatedNews = null;

            if (request.RelatedNewsId is int relatedNewsId)
            {
                if (!_moderation.IsContentManager(User)) return Forbid();
                relatedNews = await _db.News.FirstOrDefaultAsync(n => n.Id == relatedNewsId, ct);
                if (relatedNews is null)
                {
                    return BadRequest("Odabrana novost ne postoji.");
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

            var album = new GalleryAlbum
            {
                Title = title,
                Description = description,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                AreaId = classification.Area?.Id,
                Area = classification.Area,
                TimePerspective = classification.TimePerspective,
                EventDate = request.EventDate,
                Photographer = string.IsNullOrWhiteSpace(request.Photographer) ? null : request.Photographer.Trim(),
                CreatedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                EditorialStatus = EditorialStatus.Draft,
            };

            foreach (var tag in classification.Tags)
            {
                album.GalleryAlbumTags.Add(new GalleryAlbumTag
                {
                    GalleryAlbum = album,
                    Tag = tag,
                    TagId = tag.Id,
                });
            }

            _db.GalleryAlbums.Add(album);

            if (relatedNews is not null)
            {
                if (relatedNews.GalleryAlbumId.HasValue) return Conflict("Odabrana novost već ima album.");
                relatedNews.GalleryAlbum = album;
                _workflow.ResetAfterEdit(relatedNews, User);
            }
            await ContentTranslationService.ApplyAsync(_db, album, request.Translations, ct);
            try { await _images.SaveAsync(album, album.Title, imageUpload, classification.Tags, User.FindFirstValue(ClaimTypes.NameIdentifier), ct); }
            catch (DbUpdateConcurrencyException) { return Conflict(EditorialWorkflowService.ConcurrencyMessage); }

            var summary = new GalleryAlbumSummaryDto(
                album.Id,
                album.Title,
                album.Description,
                album.Images.Count,
                album.Images.FirstOrDefault() is { } cover ? ToDto(cover) : null,
                relatedNews?.Id,
                relatedNews?.Title,
                relatedNews?.Slug)
            {
                CreatedAt = album.CreatedAt,
                EventDate = album.EventDate,
                Photographer = album.Photographer,
                EditorialStatus = album.EditorialStatus?.ToString(),
                RowVersion = Convert.ToBase64String(album.RowVersion),
                CanEdit = true,
                CanSubmit = true,
                CanViewHistory = true,
                Area = album.Area is null
                    ? null
                    : new AreaReferenceDto(album.Area.Id, album.Area.Name, album.Area.Slug),
                TimePerspective = album.TimePerspective?.ToString(),
                Tags = album.GalleryAlbumTags
                    .Select(link => new TagDto(link.Tag.Id, link.Tag.Name, link.Tag.Slug, link.Tag.IsActive))
                    .OrderBy(tag => tag.Name)
                    .ToList(),
            };
            return CreatedAtAction(nameof(GetAlbum), new { albumId = album.Id }, summary);
        }

        [HttpPut("albums/{albumId:int}")]
        [Authorize(Policy = PolicyNames.ContentCreate)]
        public async Task<IActionResult> UpdateAlbum(
            int albumId,
            CreateGalleryAlbumRequest request,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest("Title is required.");
            }

            var album = await _db.GalleryAlbums
                .Include(candidate => candidate.GalleryAlbumTags)
                    .ThenInclude(link => link.Tag)
                .FirstOrDefaultAsync(candidate => candidate.Id == albumId, ct);

            if (album is null)
            {
                return NotFound();
            }

            if (!_moderation.CanEdit(User, album.CreatedByUserId, album.EditorialStatus)) return Forbid();
            if (!EditorialWorkflowService.MatchesVersion(album.RowVersion, request.RowVersion))
                return Conflict(EditorialWorkflowService.ConcurrencyMessage);
            if (request.Title.Trim().Length > 200 || request.Description?.Length > 512 || request.Photographer?.Length > 200)
                return BadRequest("Naslov, opis ili ime fotografa su predugi.");

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

            News? selectedNews = null;
            if (request.RelatedNewsId is int relatedNewsId)
            {
                if (!_moderation.IsContentManager(User)) return Forbid();
                selectedNews = await _db.News.FirstOrDefaultAsync(news => news.Id == relatedNewsId, ct);
                if (selectedNews is null)
                {
                    return BadRequest("Odabrana novost ne postoji.");
                }

                if (selectedNews.GalleryAlbumId is int existingAlbumId && existingAlbumId != albumId)
                {
                    return Conflict("Odabrana novost već je povezana s drugim albumom.");
                }
            }

            var relatedNews = await _db.News
                .Where(news => news.GalleryAlbumId == albumId)
                .ToListAsync(ct);

            if (!_moderation.IsContentManager(User) && relatedNews.Any())
                return Forbid();
            foreach (var news in relatedNews.Where(news => news.Id != selectedNews?.Id))
            {
                news.GalleryAlbumId = null;
                _workflow.ResetAfterEdit(news, User);
            }

            if (selectedNews is not null && selectedNews.GalleryAlbumId != albumId)
            {
                selectedNews.GalleryAlbumId = albumId;
                _workflow.ResetAfterEdit(selectedNews, User);
            }

            album.Title = request.Title.Trim();
            album.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            album.AreaId = classification.Area?.Id;
            album.Area = classification.Area;
            album.TimePerspective = classification.TimePerspective;
            album.EventDate = request.EventDate;
            album.Photographer = string.IsNullOrWhiteSpace(request.Photographer) ? null : request.Photographer.Trim();
            _workflow.ResetAfterEdit(album, User);

            var requestedTagIds = classification.Tags.Select(tag => tag.Id).ToHashSet();
            var removedLinks = album.GalleryAlbumTags
                .Where(link => !requestedTagIds.Contains(link.TagId))
                .ToList();
            _db.GalleryAlbumTags.RemoveRange(removedLinks);
            foreach (var removedLink in removedLinks)
            {
                album.GalleryAlbumTags.Remove(removedLink);
            }

            var existingTagIds = album.GalleryAlbumTags.Select(link => link.TagId).ToHashSet();
            foreach (var tag in classification.Tags.Where(tag => !existingTagIds.Contains(tag.Id)))
            {
                album.GalleryAlbumTags.Add(new GalleryAlbumTag
                {
                    GalleryAlbum = album,
                    Tag = tag,
                    TagId = tag.Id,
                });
            }

            await ContentTranslationService.ApplyAsync(_db, album, request.Translations, ct);
            try { await _images.SaveAsync(album, album.Title, imageUpload, classification.Tags, User.FindFirstValue(ClaimTypes.NameIdentifier), ct); }
            catch (DbUpdateConcurrencyException) { return Conflict(EditorialWorkflowService.ConcurrencyMessage); }
            return NoContent();
        }

        [HttpPost]
        [Authorize(Policy = PolicyNames.ContentCreate)]
        public async Task<ActionResult<GalleryItemDto>> Create(CreateGalleryItemRequest request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.MediaType) || string.IsNullOrWhiteSpace(request.Base64Data))
            {
                return BadRequest("Title, media type and data are required.");
            }

            if (request.Title.Trim().Length > 200 || request.Description?.Length > 512
                || request.FileName?.Length > 260 || request.ContentType?.Length > 128)
                return BadRequest("Metapodaci datoteke su predugi.");
            if (request.Base64Data.Length > (GalleryMediaValidation.MaximumBytes + 2) / 3 * 4)
                return BadRequest("Najveća veličina datoteke je 20 MB.");
            if (!Enum.GetNames<GalleryMediaType>().Contains(request.MediaType, StringComparer.OrdinalIgnoreCase)
                || !Enum.TryParse<GalleryMediaType>(request.MediaType, true, out var mediaType))
            {
                return BadRequest($"Unsupported media type '{request.MediaType}'.");
            }

            byte[] data;
            try
            {
                data = Convert.FromBase64String(request.Base64Data);
            }
            catch (FormatException)
            {
                return BadRequest("Provided media data is not valid base64.");
            }

            var album = await _db.GalleryAlbums.FirstOrDefaultAsync(a => a.Id == request.AlbumId, ct);
            if (!GalleryMediaValidation.IsSupported(mediaType, request.ContentType, data))
                return BadRequest("Dopušteni su PNG, JPEG, GIF, WebP, MP4 i WebM s odgovarajućim sadržajem (do 20 MB).");

            if (album is null)
            {
                return BadRequest("Odabrani album ne postoji.");
            }

            var entity = new GalleryImage
            {
                Title = request.Title.Trim(),
                Description = request.Description?.Trim(),
                MediaType = mediaType,
                ContentType = request.ContentType,
                FileName = request.FileName,
                Data = data,
                Size = data.LongLength,
                UploadedAt = DateTime.UtcNow,
                UploadedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
                IsFeatured = request.IsFeatured,
                AlbumId = album.Id,
                Album = album,
            };

            if (!_moderation.CanEdit(User, album.CreatedByUserId, album.EditorialStatus)) return Forbid();
            _db.GalleryImages.Add(entity);
            _workflow.ResetAfterEdit(album, User);
            await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, ct);
            try { await _db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException) { return Conflict(EditorialWorkflowService.ConcurrencyMessage); }

            return CreatedAtAction(nameof(GetOne), new { id = entity.Id }, ToDto(entity));
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = PolicyNames.PortalAccess)]
        public async Task<ActionResult<GalleryItemDto>> Update(int id, UpdateGalleryItemRequest request, CancellationToken ct)
        {
            var entity = await _db.GalleryImages.Include(g => g.Album).FirstOrDefaultAsync(g => g.Id == id, ct);

            if (entity is null)
            {
                return NotFound();
            }

            if (!CanModifyGalleryItem(entity))
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest("Title is required.");
            }

            entity.Title = request.Title.Trim();
            if (entity.Title.Length > 200 || request.Description?.Length > 512)
                return BadRequest("Naslov ili opis su predugi.");
            entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            entity.IsFeatured = request.IsFeatured;

            var album = await _db.GalleryAlbums.FirstOrDefaultAsync(a => a.Id == entity.AlbumId, ct);
            if (album is not null)
            {
                _workflow.ResetAfterEdit(album, User);
            }

            await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, ct);
            try { await _db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException) { return Conflict(EditorialWorkflowService.ConcurrencyMessage); }
            return Ok(ToDto(entity));
        }

        [HttpDelete("{id:int}")]
        [Authorize(Policy = PolicyNames.PortalAccess)]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var entity = await _db.GalleryImages.Include(g => g.Album).FirstOrDefaultAsync(g => g.Id == id, ct);

            if (entity is null)
            {
                return NotFound();
            }

            if (!CanModifyGalleryItem(entity))
            {
                return Forbid();
            }

            if (await _images.IsReferencedAsync(entity, ct))
                return Conflict("Fotografija se koristi u sadržaju. Najprije promijenite njegovu naslovnu fotografiju.");
            _db.GalleryImages.Remove(entity);
            if (entity.Album is not null) _workflow.ResetAfterEdit(entity.Album, User);
            try { await _db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException) { return Conflict(EditorialWorkflowService.ConcurrencyMessage); }

            return NoContent();
        }

        private bool CanManageAllGalleryItems() =>
            User.IsInRole(RoleNames.SuperUser) || User.IsInRole(RoleNames.Administrator);

        private bool CanModifyGalleryItem(GalleryImage image)
        {
            if (image.Album is null || !_moderation.CanEdit(User, image.Album.CreatedByUserId, image.Album.EditorialStatus))
                return false;
            if (CanManageAllGalleryItems())
            {
                return true;
            }

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(currentUserId) || string.IsNullOrWhiteSpace(image.UploadedByUserId))
            {
                return false;
            }

            return string.Equals(currentUserId, image.UploadedByUserId, StringComparison.Ordinal);
        }

        private async Task<bool> CanViewAlbumAsync(GalleryAlbum? album, CancellationToken ct) =>
            album is not null && ((album.EditorialStatus == EditorialStatus.Published && album.PublishedAt <= DateTime.UtcNow)
            || await _workflow.CanPreviewAsync(User, album, ct));

        private GalleryItemDto ToDto(GalleryImage image)
        {
            var canModify = CanModifyGalleryItem(image);

            return new GalleryItemDto(
                image.Id,
                image.AlbumId,
                image.Title,
                image.Description,
                image.MediaType.ToString(),
                image.ContentType,
                image.FileName,
                image.Size,
                image.IsFeatured,
                image.UploadedAt,
                canModify,
                canModify);
        }

        private static readonly Expression<Func<GalleryImage, GalleryImage>> MetadataProjection = image => new GalleryImage
        {
            Id = image.Id, AlbumId = image.AlbumId, Album = image.Album, Title = image.Title,
            Description = image.Description, MediaType = image.MediaType, ContentType = image.ContentType,
            FileName = image.FileName, Size = image.Size, IsFeatured = image.IsFeatured,
            UploadedAt = image.UploadedAt, UploadedByUserId = image.UploadedByUserId,
        };
    }
}
