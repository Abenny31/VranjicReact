using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnnouncementsController : ControllerBase
{
    private const int DefaultPageSize = 100;
    private const int MaximumPageSize = 200;

    private readonly VranjicContext _db;
    private readonly ContentClassificationService _classification;
    private readonly AreaModerationService _moderation;
    private readonly EditorialWorkflowService _workflow;

    public AnnouncementsController(
        VranjicContext db,
        ContentClassificationService classification,
        AreaModerationService moderation,
        EditorialWorkflowService workflow)
    {
        _db = db;
        _classification = classification;
        _moderation = moderation;
        _workflow = workflow;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AnnouncementSummaryDto>>> GetAll(
        [FromQuery] int? limit,
        [FromQuery] bool includeExpired,
        [FromQuery] bool includeUnpublished,
        [FromQuery] string? area,
        [FromQuery] int? tagId,
        [FromQuery] int page = 1,
        CancellationToken cancellationToken = default)
    {
        if (!ListPagination.IsValidPage(page)) return BadRequest("Neispravna stranica.");
        var utcNow = DateTime.UtcNow;
        var canManage = CanManageContent();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        IQueryable<Announcement> query = _db.Announcements.AsNoTracking();

        if (!(includeUnpublished && canManage))
        {
            if (includeUnpublished && !string.IsNullOrWhiteSpace(userId))
            {
                query = query.Where(announcement =>
                    (announcement.PublishedAt.HasValue
                        && announcement.PublishedAt <= utcNow
                        && announcement.StartsAt <= utcNow)
                    || announcement.CreatedByUserId == userId);
            }
            else
            {
                query = query.Where(announcement =>
                    announcement.PublishedAt.HasValue
                    && announcement.PublishedAt <= utcNow
                    && announcement.StartsAt <= utcNow);
            }
        }

        if (!includeExpired && !(includeUnpublished && canManage))
        {
            query = query.Where(announcement =>
                !announcement.ExpiresAt.HasValue || announcement.ExpiresAt > utcNow);
        }

        if (!string.IsNullOrWhiteSpace(area))
        {
            var areaSlug = area.Trim().ToLowerInvariant();
            query = query.Where(announcement =>
                announcement.Area != null
                && announcement.Area.Slug == areaSlug
                && ((includeUnpublished && canManage) || announcement.Area.IsActive));
        }

        if (tagId is > 0)
        {
            query = query.Where(announcement =>
                announcement.AnnouncementTags.Any(link => link.TagId == tagId));
        }

        var take = limit is > 0
            ? Math.Min(limit.Value, MaximumPageSize)
            : DefaultPageSize;

        var projections = await query
            .OrderByDescending(announcement =>
                announcement.Importance == AnnouncementImportance.Urgent
                    ? 3
                    : announcement.Importance == AnnouncementImportance.Important ? 2 : 1)
            .ThenByDescending(announcement => announcement.StartsAt)
            .ThenByDescending(announcement => announcement.Id)
            .Skip((page - 1) * take).Take(take + 1)
            .Select(announcement => new
            {
                announcement.Id,
                announcement.Slug,
                announcement.Title,
                announcement.Summary,
                announcement.StartsAt,
                announcement.ExpiresAt,
                announcement.PublishedAt,
                announcement.Importance,
                announcement.ActionLabel,
                announcement.ActionUrl,
                announcement.EditorialStatus,
                announcement.RowVersion,
                announcement.CreatedByUserId,
                Area = announcement.Area == null
                    ? null
                    : new AreaReferenceDto(
                        announcement.Area.Id,
                        announcement.Area.Name,
                        announcement.Area.Slug),
            })
            .ToListAsync(cancellationToken);

        ListPagination.Complete(Response, projections, take);
        return Ok(projections.Select(item =>
            new AnnouncementSummaryDto(
                item.Id,
                item.Slug,
                item.Title,
                item.Summary,
                item.StartsAt,
                item.ExpiresAt,
                item.PublishedAt,
                item.Importance.ToString(),
                item.ActionLabel,
                item.ActionUrl,
                AnnouncementSchedule.IsActive(item.PublishedAt, item.StartsAt, item.ExpiresAt, utcNow),
                AnnouncementSchedule.IsExpired(item.ExpiresAt, utcNow))
            {
                Area = item.Area,
                EditorialStatus = item.EditorialStatus?.ToString(),
                RowVersion = Convert.ToBase64String(item.RowVersion),
                CanEdit = _moderation.CanEdit(User, item.CreatedByUserId, item.EditorialStatus),
                CanSubmit = _moderation.CanEdit(User, item.CreatedByUserId, item.EditorialStatus)
                    && EditorialWorkflowService.CanSubmit(item.EditorialStatus),
            }).ToList());
    }

    [HttpGet("{slugOrId}")]
    public async Task<ActionResult<AnnouncementDetailDto>> GetOne(
        string slugOrId,
        [FromQuery] bool includeUnpublished,
        CancellationToken cancellationToken)
    {
        var query = _db.Announcements
            .AsNoTracking()
            .Include(announcement => announcement.Area)
            .Include(announcement => announcement.AnnouncementTags)
                .ThenInclude(link => link.Tag);

        Announcement? entity;
        if (int.TryParse(slugOrId, out var id))
        {
            entity = await query.FirstOrDefaultAsync(announcement => announcement.Id == id, cancellationToken);
        }
        else
        {
            entity = await query.FirstOrDefaultAsync(announcement => announcement.Slug == slugOrId, cancellationToken);
        }

        if (entity is null || (!CanView(entity, includeUnpublished)
            && !(includeUnpublished && await _workflow.CanPreviewAsync(User, entity, cancellationToken))))
        {
            return NotFound();
        }

        return Ok(ToDetailDto(entity, DateTime.UtcNow));
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.ContentCreate)]
    public async Task<ActionResult<AnnouncementDetailDto>> Create(
        UpsertAnnouncementRequest request,
        CancellationToken cancellationToken)
    {
        var validationError = Validate(request, out var importance);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var classification = await _classification.ResolveAsync(
            request.AreaId,
            null,
            request.TagIds,
            cancellationToken);
        if (!classification.IsValid)
        {
            return BadRequest(classification.ValidationError);
        }

        var slugSource = string.IsNullOrWhiteSpace(request.Slug) ? request.Title : request.Slug;
        var slug = await EnsureUniqueSlugAsync(CreateSlug(slugSource), null, cancellationToken);
        var utcNow = DateTime.UtcNow;
        var entity = new Announcement
        {
            Slug = slug,
            Title = request.Title.Trim(),
            Summary = request.Summary.Trim(),
            Body = request.Body,
            StartsAt = request.StartsAt.ToUniversalTime(),
            ExpiresAt = request.ExpiresAt?.ToUniversalTime(),
            PublishedAt = ContentPublicationRules.ResolvePublishedAt(CanManageContent(), request.PublishedAt),
            EditorialStatus = CanManageContent() && request.PublishedAt.HasValue
                ? EditorialStatus.Published : EditorialStatus.Draft,
            Importance = importance,
            ActionLabel = NullIfWhiteSpace(request.ActionLabel),
            ActionUrl = NullIfWhiteSpace(request.ActionUrl),
            Area = classification.Area,
            AreaId = classification.Area?.Id,
            CreatedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };

        foreach (var tag in classification.Tags)
        {
            entity.AnnouncementTags.Add(new AnnouncementTag
            {
                Announcement = entity,
                Tag = tag,
                TagId = tag.Id,
            });
        }

        _db.Announcements.Add(entity);
        _workflow.RecordPublication(entity, User);
        await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetOne),
            new { slugOrId = entity.Slug },
            ToDetailDto(entity, utcNow));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PolicyNames.ContentCreate)]
    public async Task<ActionResult<AnnouncementDetailDto>> Update(
        int id,
        UpsertAnnouncementRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await _db.Announcements
            .Include(announcement => announcement.Area)
            .Include(announcement => announcement.AnnouncementTags)
                .ThenInclude(link => link.Tag)
            .FirstOrDefaultAsync(announcement => announcement.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        if (!_moderation.CanEdit(User, entity.CreatedByUserId, entity.EditorialStatus)) return Forbid();
        if (!EditorialWorkflowService.MatchesVersion(entity.RowVersion, request.RowVersion))
            return Conflict(EditorialWorkflowService.ConcurrencyMessage);

        var validationError = Validate(request, out var importance);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var classification = await _classification.ResolveAsync(
            request.AreaId,
            null,
            request.TagIds,
            cancellationToken);
        if (!classification.IsValid)
        {
            return BadRequest(classification.ValidationError);
        }

        var slugSource = string.IsNullOrWhiteSpace(request.Slug) ? request.Title : request.Slug;
        entity.Slug = await EnsureUniqueSlugAsync(
            CreateSlug(slugSource),
            entity.Id,
            cancellationToken);
        entity.Title = request.Title.Trim();
        entity.Summary = request.Summary.Trim();
        entity.Body = request.Body;
        entity.StartsAt = request.StartsAt.ToUniversalTime();
        entity.ExpiresAt = request.ExpiresAt?.ToUniversalTime();
        _workflow.ResetAfterEdit(entity, User);
        entity.Importance = importance;
        entity.ActionLabel = NullIfWhiteSpace(request.ActionLabel);
        entity.ActionUrl = NullIfWhiteSpace(request.ActionUrl);
        entity.Area = classification.Area;
        entity.AreaId = classification.Area?.Id;
        entity.UpdatedAt = DateTime.UtcNow;

        var requestedTagIds = classification.Tags.Select(tag => tag.Id).ToHashSet();
        var removedLinks = entity.AnnouncementTags
            .Where(link => !requestedTagIds.Contains(link.TagId))
            .ToList();
        _db.AnnouncementTags.RemoveRange(removedLinks);
        foreach (var removedLink in removedLinks)
        {
            entity.AnnouncementTags.Remove(removedLink);
        }

        var existingTagIds = entity.AnnouncementTags.Select(link => link.TagId).ToHashSet();
        foreach (var tag in classification.Tags.Where(tag => !existingTagIds.Contains(tag.Id)))
        {
            entity.AnnouncementTags.Add(new AnnouncementTag
            {
                Announcement = entity,
                Tag = tag,
                TagId = tag.Id,
            });
        }

        await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, cancellationToken);
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { return Conflict(EditorialWorkflowService.ConcurrencyMessage); }
        return Ok(ToDetailDto(entity, DateTime.UtcNow));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PolicyNames.ContentManage)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await _db.Announcements.FirstOrDefaultAsync(
            announcement => announcement.Id == id,
            cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        if (await _db.ContentModerationActions.AnyAsync(a => a.AnnouncementId == id, cancellationToken))
            return Conflict("Sadržaj s poviješću moderiranja arhivirajte umjesto brisanja.");
        _db.Announcements.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private bool CanView(Announcement entity, bool includeUnpublished)
    {
        var utcNow = DateTime.UtcNow;
        if (entity.PublishedAt.HasValue
            && entity.PublishedAt <= utcNow
            && entity.StartsAt <= utcNow)
        {
            return true;
        }

        if (!includeUnpublished || User.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        return CanManageContent()
            || entity.CreatedByUserId == User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    private bool CanManageContent() =>
        User.Identity?.IsAuthenticated == true && RoleNames.ContentManage.Any(User.IsInRole);

    private async Task<string> EnsureUniqueSlugAsync(
        string baseSlug,
        int? existingId,
        CancellationToken cancellationToken)
    {
        var slug = baseSlug;
        var suffix = 1;
        while (await _db.Announcements.AnyAsync(
            announcement => announcement.Slug == slug && announcement.Id != existingId,
            cancellationToken))
        {
            slug = $"{baseSlug}-{suffix++}";
        }

        return slug;
    }

    private static string? Validate(
        UpsertAnnouncementRequest request,
        out AnnouncementImportance importance)
    {
        importance = AnnouncementImportance.Normal;
        if (string.IsNullOrWhiteSpace(request.Title)
            || string.IsNullOrWhiteSpace(request.Summary)
            || string.IsNullOrWhiteSpace(request.Body))
        {
            return "Naslov, sažetak i sadržaj su obvezni.";
        }

        if (request.Title.Trim().Length > 200)
        {
            return "Naslov može imati najviše 200 znakova.";
        }

        if (request.Summary.Trim().Length > 512)
        {
            return "Sažetak može imati najviše 512 znakova.";
        }

        if (request.StartsAt == default)
        {
            return "Početak prikazivanja je obvezan.";
        }

        if (request.ExpiresAt.HasValue && request.ExpiresAt <= request.StartsAt)
        {
            return "Datum isteka mora biti nakon početka prikazivanja.";
        }

        var requestedImportance = request.Importance?.Trim();
        if (string.IsNullOrWhiteSpace(requestedImportance)
            || !Enum.GetNames<AnnouncementImportance>().Contains(
                requestedImportance,
                StringComparer.OrdinalIgnoreCase)
            || !Enum.TryParse(requestedImportance, true, out importance))
        {
            return "Važnost mora biti Normal, Important ili Urgent.";
        }

        var actionLabel = NullIfWhiteSpace(request.ActionLabel);
        var actionUrl = NullIfWhiteSpace(request.ActionUrl);
        if (actionLabel?.Length > 100 || actionUrl?.Length > 1024)
        {
            return "Naziv ili poveznica akcije su predugi.";
        }

        if ((actionLabel is null) != (actionUrl is null))
        {
            return "Naziv i poveznica akcije moraju biti uneseni zajedno.";
        }

        if (actionUrl is not null && !IsSafeActionUrl(actionUrl))
        {
            return "Poveznica akcije mora biti relativna ili valjana HTTP/HTTPS adresa.";
        }

        return null;
    }

    private static bool IsSafeActionUrl(string value)
    {
        if (value.StartsWith('/') && !value.StartsWith("//", StringComparison.Ordinal))
        {
            return true;
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && !string.IsNullOrWhiteSpace(uri.Host)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    private static string CreateSlug(string value)
    {
        const int maximumBaseLength = 118;
        var slug = SlugHelper.GenerateSlug(value);
        return slug.Length <= maximumBaseLength
            ? slug
            : slug[..maximumBaseLength].TrimEnd('-');
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private AnnouncementDetailDto ToDetailDto(Announcement entity, DateTime utcNow) =>
        new(
            entity.Id,
            entity.Slug,
            entity.Title,
            entity.Summary,
            entity.Body,
            entity.StartsAt,
            entity.ExpiresAt,
            entity.PublishedAt,
            entity.Importance.ToString(),
            entity.ActionLabel,
            entity.ActionUrl,
            AnnouncementSchedule.IsActive(entity.PublishedAt, entity.StartsAt, entity.ExpiresAt, utcNow),
            AnnouncementSchedule.IsExpired(entity.ExpiresAt, utcNow),
            entity.CreatedAt,
            entity.UpdatedAt)
        {
            Area = entity.Area is null
                ? null
                : new AreaReferenceDto(entity.Area.Id, entity.Area.Name, entity.Area.Slug),
            EditorialStatus = entity.EditorialStatus?.ToString(),
            RowVersion = Convert.ToBase64String(entity.RowVersion),
            CanEdit = _moderation.CanEdit(User, entity.CreatedByUserId, entity.EditorialStatus),
            CanSubmit = _moderation.CanEdit(User, entity.CreatedByUserId, entity.EditorialStatus)
                && EditorialWorkflowService.CanSubmit(entity.EditorialStatus),
            Tags = entity.AnnouncementTags
                .Select(link => new TagDto(link.Tag.Id, link.Tag.Name, link.Tag.Slug, link.Tag.IsActive))
                .OrderBy(tag => tag.Name)
                .ToList(),
        };
}
