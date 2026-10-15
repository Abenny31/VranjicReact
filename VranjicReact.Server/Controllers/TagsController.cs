using VranjicReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TagsController : ControllerBase
{
    private readonly VranjicContext _db;

    public TagsController(VranjicContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TagDto>>> GetAll(CancellationToken cancellationToken)
    {
        var tags = await _db.Tags
            .AsNoTracking()
            .Where(tag => tag.IsActive)
            .OrderBy(tag => tag.Name)
            .ToListAsync(cancellationToken);

        return Ok(tags.Select(ToDto).ToList());
    }

    [HttpGet("admin")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<IReadOnlyList<TagDto>>> GetAdmin(CancellationToken cancellationToken)
    {
        var tags = await _db.Tags
            .AsNoTracking()
            .OrderBy(tag => tag.Name)
            .ToListAsync(cancellationToken);

        return Ok(tags.Select(ToDto).ToList());
    }

    [HttpGet("admin/{id:int}")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<TagDto>> GetAdminOne(int id, CancellationToken cancellationToken)
    {
        var tag = await _db.Tags
            .AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        return tag is null ? NotFound() : Ok(ToDto(tag));
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<TagDto>> Create(UpsertTagRequest request, CancellationToken cancellationToken)
    {
        var validationError = Validate(request);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var slug = SlugHelper.GenerateSlug(string.IsNullOrWhiteSpace(request.Slug) ? request.Name : request.Slug);
        if (await _db.Tags.AnyAsync(tag => tag.Slug == slug, cancellationToken))
        {
            return Conflict("Oznaka s tim slugom već postoji.");
        }

        var utcNow = DateTime.UtcNow;
        var tag = new Tag
        {
            Name = request.Name.Trim(),
            Slug = slug,
            IsActive = request.IsActive,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };

        _db.Tags.Add(tag);
        await ContentTranslationService.ApplyAsync(_db, tag, request.Translations, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var dto = ToDto(tag);
        return CreatedAtAction(nameof(GetAdminOne), new { id = tag.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<TagDto>> Update(
        int id,
        UpsertTagRequest request,
        CancellationToken cancellationToken)
    {
        var validationError = Validate(request);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var tag = await _db.Tags.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (tag is null)
        {
            return NotFound();
        }

        var slug = SlugHelper.GenerateSlug(string.IsNullOrWhiteSpace(request.Slug) ? request.Name : request.Slug);
        if (await _db.Tags.AnyAsync(candidate => candidate.Id != id && candidate.Slug == slug, cancellationToken))
        {
            return Conflict("Oznaka s tim slugom već postoji.");
        }

        tag.Name = request.Name.Trim();
        tag.Slug = slug;
        tag.IsActive = request.IsActive;
        tag.UpdatedAt = DateTime.UtcNow;

        await ContentTranslationService.ApplyAsync(_db, tag, request.Translations, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(tag));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (tag is null)
        {
            return NotFound();
        }

        var isInUse = await _db.NewsTags.AnyAsync(link => link.TagId == id, cancellationToken)
            || await _db.GalleryAlbumTags.AnyAsync(link => link.TagId == id, cancellationToken)
            || await _db.AnnouncementTags.AnyAsync(link => link.TagId == id, cancellationToken)
            || await _db.BlogPostTags.AnyAsync(link => link.TagId == id, cancellationToken);

        if (isInUse)
        {
            return Conflict("Oznaka je povezana sa sadržajem. Deaktivirajte je umjesto brisanja.");
        }

        _db.Tags.Remove(tag);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static TagDto ToDto(Tag tag) => new(tag.Id, tag.Name, tag.Slug, tag.IsActive);

    private static string? Validate(UpsertTagRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return "Naziv oznake je obavezan.";
        }

        return request.Name.Trim().Length > 100
            ? "Naziv oznake može imati najviše 100 znakova."
            : null;
    }
}
