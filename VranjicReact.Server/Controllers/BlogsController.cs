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
[Route("api/blog")]
public class BlogsController : ControllerBase
{
    private const int DefaultPageSize = 100;
    private const int MaximumPageSize = 200;

    private readonly VranjicContext _db;
    private readonly ContentClassificationService _classification;
    private readonly BlogContentValidationService _blogValidation;
    private readonly AreaModerationService _moderation;
    private readonly EditorialWorkflowService _workflow;
    private readonly ContentImageService _images;

    public BlogsController(
        VranjicContext db,
        ContentClassificationService classification,
        BlogContentValidationService blogValidation,
        AreaModerationService moderation,
        EditorialWorkflowService workflow,
        ContentImageService images)
    {
        _db = db;
        _classification = classification;
        _blogValidation = blogValidation;
        _moderation = moderation;
        _workflow = workflow;
        _images = images;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BlogPostSummaryDto>>> GetAll(
        [FromQuery] int? limit,
        [FromQuery] bool includeUnpublished,
        [FromQuery] string? area,
        [FromQuery] string? perspective,
        [FromQuery] int? tagId,
        [FromQuery] string? origin,
        [FromQuery] int page = 1,
        CancellationToken cancellationToken = default)
    {
        if (!ListPagination.IsValidPage(page)) return BadRequest("Neispravna stranica.");
        var utcNow = DateTime.UtcNow;
        var includeEditorialInfo = includeUnpublished && User.Identity?.IsAuthenticated == true;
        var canReviewPrivate = CanManageContent() || CanVerifyContent();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        IQueryable<BlogPost> query = _db.BlogPosts.AsNoTracking();

        if (!(includeUnpublished && canReviewPrivate))
        {
            if (includeUnpublished && !string.IsNullOrWhiteSpace(userId))
            {
                query = query.Where(post =>
                    (post.PublishedAt.HasValue && post.PublishedAt <= utcNow)
                    || post.CreatedByUserId == userId);
            }
            else
            {
                query = query.Where(post =>
                    post.PublishedAt.HasValue
                    && post.PublishedAt <= utcNow
                    && post.EditorialStatus != EditorialStatus.Archived);
            }
        }

        if (!string.IsNullOrWhiteSpace(area))
        {
            var areaSlug = area.Trim().ToLowerInvariant();
            query = query.Where(post =>
                post.Area != null
                && post.Area.Slug == areaSlug
                && ((includeUnpublished && canReviewPrivate) || post.Area.IsActive));
        }

        if (!string.IsNullOrWhiteSpace(perspective))
        {
            if (!TryParseEnumName(perspective, out ContentTimePerspective parsedPerspective))
            {
                return BadRequest("Vremenska perspektiva mora biti Jucer, Danas ili Sutra.");
            }

            query = query.Where(post => post.TimePerspective == parsedPerspective);
        }

        if (tagId is > 0)
        {
            query = query.Where(post => post.BlogPostTags.Any(link => link.TagId == tagId));
        }

        if (!string.IsNullOrWhiteSpace(origin))
        {
            if (!TryParseEnumName(origin, out ContentOrigin parsedOrigin))
            {
                return BadRequest("Podrijetlo sadržaja nije valjano.");
            }

            query = query.Where(post => post.Origin == parsedOrigin);
        }

        var take = limit is > 0 ? Math.Min(limit.Value, MaximumPageSize) : DefaultPageSize;
        var projections = await query
            .OrderByDescending(post => post.IsFeatured)
            .ThenByDescending(post => post.PublishedAt ?? post.CreatedAt)
            .ThenByDescending(post => post.Id)
            .Skip((page - 1) * take).Take(take + 1)
            .Select(post => new
            {
                post.Id,
                post.Slug,
                post.Title,
                post.Excerpt,
                post.HeroImageUrl,
                post.PublishedAt,
                post.IsFeatured,
                post.Origin,
                post.VerifiedAt,
                post.TimePerspective,
                post.EditorialStatus,
                post.RowVersion,
                post.CreatedByUserId,
                LatestModerationComment = post.ModerationActions
                    .OrderByDescending(action => action.CreatedAt)
                    .ThenByDescending(action => action.Id)
                    .Select(action => action.Comment)
                    .FirstOrDefault(),
                LatestModerationAction = post.ModerationActions
                    .OrderByDescending(action => action.CreatedAt)
                    .ThenByDescending(action => action.Id)
                    .Select(action => (ModerationActionType?)action.Action)
                    .FirstOrDefault(),
                Area = post.Area == null
                    ? null
                    : new AreaReferenceDto(post.Area.Id, post.Area.Name, post.Area.Slug),
            })
            .ToListAsync(cancellationToken);

        ListPagination.Complete(Response, projections, take);
        return Ok(projections.Select(post => new BlogPostSummaryDto(
            post.Id,
            post.Slug,
            post.Title,
            post.Excerpt,
            post.HeroImageUrl,
            post.PublishedAt,
            post.IsFeatured,
            post.Origin?.ToString(),
            post.VerifiedAt)
        {
            Area = post.Area,
            TimePerspective = post.TimePerspective?.ToString(),
            EditorialStatus = post.EditorialStatus?.ToString(),
            RowVersion = Convert.ToBase64String(post.RowVersion),
            CanEdit = _moderation.CanEdit(User, post.CreatedByUserId, post.EditorialStatus),
            CanSubmit = _moderation.CanEdit(User, post.CreatedByUserId, post.EditorialStatus)
                && CanSubmit(post.EditorialStatus),
            LatestModerationComment = includeEditorialInfo && (canReviewPrivate || post.CreatedByUserId == userId) ? post.LatestModerationComment : null,
            LatestModerationAction = includeEditorialInfo && (canReviewPrivate || post.CreatedByUserId == userId) ? post.LatestModerationAction?.ToString() : null,
        }).ToList());
    }

    [HttpGet("{slugOrId}")]
    public async Task<ActionResult<BlogPostDetailDto>> GetOne(
        string slugOrId,
        [FromQuery] bool includeUnpublished,
        CancellationToken cancellationToken)
    {
        var query = _db.BlogPosts
            .AsNoTracking()
            .Include(post => post.Area)
            .Include(post => post.BlogPostTags)
                .ThenInclude(link => link.Tag)
            .Include(post => post.Sources)
            .Include(post => post.ModerationActions);

        BlogPost? entity;
        if (int.TryParse(slugOrId, out var id))
        {
            entity = await query.FirstOrDefaultAsync(post => post.Id == id, cancellationToken);
        }
        else
        {
            entity = await query.FirstOrDefaultAsync(post => post.Slug == slugOrId, cancellationToken);
        }

        if (entity is null)
        {
            return NotFound();
        }

        if (!CanView(entity, includeUnpublished)
            && !(includeUnpublished
                && await _moderation.CanModerateAsync(
                    User,
                    entity.CreatedByUserId,
                    entity.AreaId,
                    cancellationToken)))
        {
            return NotFound();
        }

        return Ok(ToDetailDto(entity, includeUnpublished && await _workflow.CanPreviewAsync(User, entity, cancellationToken)));
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.ContentCreate)]
    public async Task<ActionResult<BlogPostDetailDto>> Create(
        UpsertBlogPostRequest request,
        CancellationToken cancellationToken)
    {
        var imageError = ContentImageService.Validate(request.ImageUpload, out var imageUpload);
        if (imageError is not null) return BadRequest(imageError);
        var validation = _blogValidation.Validate(request);
        if (!validation.IsValid)
        {
            return BadRequest(validation.Error);
        }

        if (validation.Origin == ContentOrigin.DocumentedAndVerified && !CanVerifyContent())
        {
            return Forbid();
        }

        var classification = await _classification.ResolveAsync(
            request.AreaId,
            request.TimePerspective,
            request.TagIds,
            cancellationToken);
        if (!classification.IsValid)
        {
            return BadRequest(classification.ValidationError);
        }

        var utcNow = DateTime.UtcNow;
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var slugSource = string.IsNullOrWhiteSpace(request.Slug) ? request.Title : request.Slug;
        var entity = new BlogPost
        {
            Slug = await EnsureUniqueSlugAsync(CreateSlug(slugSource), null, cancellationToken),
            Title = request.Title.Trim(),
            Excerpt = request.Excerpt.Trim(),
            Body = request.Body,
            HeroImageUrl = NullIfWhiteSpace(request.HeroImageUrl),
            PublishedAt = ContentPublicationRules.ResolvePublishedAt(CanManageContent(), request.PublishedAt),
            IsFeatured = CanManageContent() && request.IsFeatured,
            Area = classification.Area,
            AreaId = classification.Area?.Id,
            TimePerspective = classification.TimePerspective,
            Origin = validation.Origin,
            VerifiedByUserId = validation.Origin == ContentOrigin.DocumentedAndVerified ? userId : null,
            VerifiedAt = validation.Origin == ContentOrigin.DocumentedAndVerified ? utcNow : null,
            CreatedByUserId = userId,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
            EditorialStatus = CanManageContent() && request.PublishedAt.HasValue
                ? EditorialStatus.Published
                : EditorialStatus.Draft,
        };

        AddTags(entity, classification.Tags);
        AddSources(entity, validation.Sources, utcNow);

        _db.BlogPosts.Add(entity);
        _workflow.RecordPublication(entity, User);
        await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, cancellationToken);
        await _images.SaveAsync(entity, entity.Title, imageUpload, classification.Tags, User.FindFirstValue(ClaimTypes.NameIdentifier), cancellationToken);
        return CreatedAtAction(nameof(GetOne), new { slugOrId = entity.Slug }, ToDetailDto(entity, true));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PolicyNames.ContentCreate)]
    public async Task<ActionResult<BlogPostDetailDto>> Update(
        int id,
        UpsertBlogPostRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await _db.BlogPosts
            .Include(post => post.Area)
            .Include(post => post.BlogPostTags)
                .ThenInclude(link => link.Tag)
            .Include(post => post.Sources)
            .FirstOrDefaultAsync(post => post.Id == id, cancellationToken);
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

        var imageError = ContentImageService.Validate(request.ImageUpload, out var imageUpload);
        if (imageError is not null) return BadRequest(imageError);
        var validation = _blogValidation.Validate(request);
        if (!validation.IsValid)
        {
            return BadRequest(validation.Error);
        }

        if (validation.Origin == ContentOrigin.DocumentedAndVerified && !CanVerifyContent())
        {
            return Forbid();
        }

        var classification = await _classification.ResolveAsync(
            request.AreaId,
            request.TimePerspective,
            request.TagIds,
            cancellationToken);
        if (!classification.IsValid)
        {
            return BadRequest(classification.ValidationError);
        }

        var utcNow = DateTime.UtcNow;
        var slugSource = string.IsNullOrWhiteSpace(request.Slug) ? request.Title : request.Slug;
        entity.Slug = await EnsureUniqueSlugAsync(CreateSlug(slugSource), entity.Id, cancellationToken);
        entity.Title = request.Title.Trim();
        entity.Excerpt = request.Excerpt.Trim();
        entity.Body = request.Body;
        entity.HeroImageUrl = NullIfWhiteSpace(request.HeroImageUrl);
        entity.IsFeatured = _moderation.IsContentManager(User) && request.IsFeatured;
        entity.Area = classification.Area;
        entity.AreaId = classification.Area?.Id;
        entity.TimePerspective = classification.TimePerspective;
        entity.Origin = validation.Origin;
        entity.VerifiedByUserId = validation.Origin == ContentOrigin.DocumentedAndVerified
            ? User.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;
        entity.VerifiedAt = validation.Origin == ContentOrigin.DocumentedAndVerified ? utcNow : null;
        entity.UpdatedAt = utcNow;

        _workflow.ResetAfterEdit(entity, User);

        ReplaceTags(entity, classification.Tags);
        _db.BlogPostSources.RemoveRange(entity.Sources);
        entity.Sources.Clear();
        AddSources(entity, validation.Sources, utcNow);

        await ContentTranslationService.ApplyAsync(_db, entity, request.Translations, cancellationToken);
        try
        {
            await _images.SaveAsync(entity, entity.Title, imageUpload, classification.Tags, User.FindFirstValue(ClaimTypes.NameIdentifier), cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("Sadržaj je u međuvremenu promijenjen. Osvježite podatke i pokušajte ponovno.");
        }
        return Ok(ToDetailDto(entity, true));
    }

    [HttpPost("{id:int}/verify")]
    [Authorize(Policy = PolicyNames.ContentVerify)]
    public async Task<ActionResult<BlogPostDetailDto>> Verify(int id, CancellationToken cancellationToken)
    {
        var entity = await _db.BlogPosts
            .Include(post => post.Area)
            .Include(post => post.BlogPostTags)
                .ThenInclude(link => link.Tag)
            .Include(post => post.Sources)
            .FirstOrDefaultAsync(post => post.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        if (entity.Sources.Count == 0)
        {
            return BadRequest("Dokumentirani sadržaj mora imati najmanje jedan izvor.");
        }

        entity.Origin = ContentOrigin.DocumentedAndVerified;
        entity.VerifiedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        entity.VerifiedAt = DateTime.UtcNow;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ToDetailDto(entity, true));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PolicyNames.ContentManage)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var entity = await _db.BlogPosts.FirstOrDefaultAsync(post => post.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        if (await _db.ContentModerationActions.AnyAsync(action => action.BlogPostId == id, cancellationToken))
        {
            return Conflict("Sadržaj s poviješću moderiranja nije moguće trajno obrisati.");
        }

        _db.BlogPosts.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private bool CanView(BlogPost entity, bool includeUnpublished)
    {
        if (entity.PublishedAt.HasValue
            && entity.PublishedAt <= DateTime.UtcNow
            && entity.EditorialStatus != EditorialStatus.Archived)
        {
            return true;
        }

        if (!includeUnpublished || User.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        return CanManageContent()
            || CanVerifyContent()
            || entity.CreatedByUserId == User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    private bool CanManageContent() =>
        User.Identity?.IsAuthenticated == true && RoleNames.ContentManage.Any(User.IsInRole);

    private bool CanVerifyContent() =>
        User.Identity?.IsAuthenticated == true && RoleNames.ContentVerify.Any(User.IsInRole);

    private async Task<string> EnsureUniqueSlugAsync(
        string baseSlug,
        int? existingId,
        CancellationToken cancellationToken)
    {
        var slug = baseSlug;
        var suffix = 1;
        while (await _db.BlogPosts.AnyAsync(
            post => post.Slug == slug && post.Id != existingId,
            cancellationToken))
        {
            slug = $"{baseSlug}-{suffix++}";
        }

        return slug;
    }

    private void ReplaceTags(BlogPost entity, IReadOnlyList<Tag> tags)
    {
        var requestedTagIds = tags.Select(tag => tag.Id).ToHashSet();
        var removedLinks = entity.BlogPostTags
            .Where(link => !requestedTagIds.Contains(link.TagId))
            .ToList();
        _db.BlogPostTags.RemoveRange(removedLinks);
        foreach (var removedLink in removedLinks)
        {
            entity.BlogPostTags.Remove(removedLink);
        }

        var existingTagIds = entity.BlogPostTags.Select(link => link.TagId).ToHashSet();
        AddTags(entity, tags.Where(tag => !existingTagIds.Contains(tag.Id)).ToList());
    }

    private static void AddTags(BlogPost entity, IReadOnlyList<Tag> tags)
    {
        foreach (var tag in tags)
        {
            entity.BlogPostTags.Add(new BlogPostTag
            {
                BlogPost = entity,
                Tag = tag,
                TagId = tag.Id,
            });
        }
    }

    private static void AddSources(
        BlogPost entity,
        IReadOnlyList<ValidatedBlogSource> sources,
        DateTime utcNow)
    {
        foreach (var source in sources)
        {
            entity.Sources.Add(new BlogPostSource
            {
                BlogPost = entity,
                Title = source.Title,
                Author = source.Author,
                Year = source.Year,
                Type = source.Type,
                Url = source.Url,
                Note = source.Note,
                CreatedAt = utcNow,
            });
        }
    }

    private static bool TryParseEnumName<TEnum>(string value, out TEnum parsed)
        where TEnum : struct, Enum
    {
        parsed = default;
        var normalized = value.Trim();
        return Enum.GetNames<TEnum>().Contains(normalized, StringComparer.OrdinalIgnoreCase)
            && Enum.TryParse(normalized, true, out parsed);
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

    private BlogPostDetailDto ToDetailDto(BlogPost entity, bool includeEditorialInfo) =>
        new(
            entity.Id,
            entity.Slug,
            entity.Title,
            entity.Excerpt,
            entity.Body,
            entity.HeroImageUrl,
            entity.PublishedAt,
            entity.IsFeatured,
            entity.Origin?.ToString(),
            entity.VerifiedAt,
            entity.CreatedAt,
            entity.UpdatedAt)
        {
            Area = entity.Area is null
                ? null
                : new AreaReferenceDto(entity.Area.Id, entity.Area.Name, entity.Area.Slug),
            TimePerspective = entity.TimePerspective?.ToString(),
            Tags = entity.BlogPostTags
                .Select(link => new TagDto(link.Tag.Id, link.Tag.Name, link.Tag.Slug, link.Tag.IsActive))
                .OrderBy(tag => tag.Name)
                .ToList(),
            Sources = entity.Sources
                .OrderBy(source => source.Year)
                .ThenBy(source => source.Title)
                .Select(source => new BlogPostSourceDto(
                    source.Id,
                    source.Title,
                    source.Author,
                    source.Year,
                    source.Type.ToString(),
                    source.Url,
                    source.Note))
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
