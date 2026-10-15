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
public class AreasController : ControllerBase
{
    private readonly VranjicContext _db;

    public AreasController(VranjicContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AreaDto>>> GetAll(CancellationToken cancellationToken)
    {
        var areas = await _db.Areas
            .AsNoTracking()
            .Where(area => area.IsActive)
            .OrderBy(area => area.SortOrder)
            .ThenBy(area => area.Name)
            .ToListAsync(cancellationToken);

        return Ok(areas.Select(ToDto).ToList());
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<AreaDto>> GetOne(string slug, CancellationToken cancellationToken)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var area = await _db.Areas
            .AsNoTracking()
            .FirstOrDefaultAsync(
                candidate => candidate.IsActive && candidate.Slug == normalizedSlug,
                cancellationToken);

        return area is null ? NotFound() : Ok(ToDto(area));
    }

    [HttpGet("admin")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<IReadOnlyList<AreaDto>>> GetAdmin(CancellationToken cancellationToken)
    {
        var areas = await _db.Areas
            .AsNoTracking()
            .OrderBy(area => area.SortOrder)
            .ThenBy(area => area.Name)
            .ToListAsync(cancellationToken);

        return Ok(areas.Select(ToDto).ToList());
    }

    [HttpGet("admin/{id:int}")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<AreaDto>> GetAdminOne(int id, CancellationToken cancellationToken)
    {
        var area = await _db.Areas
            .AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        return area is null ? NotFound() : Ok(ToDto(area));
    }

    [HttpPost]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<AreaDto>> Create(UpsertAreaRequest request, CancellationToken cancellationToken)
    {
        var validationError = Validate(request);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var slug = SlugHelper.GenerateSlug(string.IsNullOrWhiteSpace(request.Slug) ? request.Name : request.Slug);
        if (await _db.Areas.AnyAsync(area => area.Slug == slug, cancellationToken))
        {
            return Conflict("Područje s tim slugom već postoji.");
        }

        var utcNow = DateTime.UtcNow;
        var area = new Area
        {
            Name = request.Name.Trim(),
            Slug = slug,
            ShortDescription = NormalizeOptional(request.ShortDescription),
            Description = NormalizeOptional(request.Description),
            CoverImageUrl = NormalizeOptional(request.CoverImageUrl),
            SortOrder = request.SortOrder,
            IsActive = request.IsActive,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };

        _db.Areas.Add(area);
        await ContentTranslationService.ApplyAsync(_db, area, request.Translations, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var dto = ToDto(area);
        return CreatedAtAction(nameof(GetAdminOne), new { id = area.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<ActionResult<AreaDto>> Update(
        int id,
        UpsertAreaRequest request,
        CancellationToken cancellationToken)
    {
        var validationError = Validate(request);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var area = await _db.Areas.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (area is null)
        {
            return NotFound();
        }

        var slug = SlugHelper.GenerateSlug(string.IsNullOrWhiteSpace(request.Slug) ? request.Name : request.Slug);
        if (await _db.Areas.AnyAsync(candidate => candidate.Id != id && candidate.Slug == slug, cancellationToken))
        {
            return Conflict("Područje s tim slugom već postoji.");
        }

        area.Name = request.Name.Trim();
        area.Slug = slug;
        area.ShortDescription = NormalizeOptional(request.ShortDescription);
        area.Description = NormalizeOptional(request.Description);
        area.CoverImageUrl = NormalizeOptional(request.CoverImageUrl);
        area.SortOrder = request.SortOrder;
        area.IsActive = request.IsActive;
        area.UpdatedAt = DateTime.UtcNow;

        await ContentTranslationService.ApplyAsync(_db, area, request.Translations, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(area));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = PolicyNames.ClassificationManage)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var area = await _db.Areas.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (area is null)
        {
            return NotFound();
        }

        var isInUse = await _db.News.AnyAsync(news => news.AreaId == id, cancellationToken)
            || await _db.GalleryAlbums.AnyAsync(album => album.AreaId == id, cancellationToken)
            || await _db.Announcements.AnyAsync(announcement => announcement.AreaId == id, cancellationToken)
            || await _db.BlogPosts.AnyAsync(post => post.AreaId == id, cancellationToken);

        if (isInUse)
        {
            return Conflict("Područje je povezano sa sadržajem. Deaktivirajte ga umjesto brisanja.");
        }

        _db.Areas.Remove(area);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static AreaDto ToDto(Area area) =>
        new(
            area.Id,
            area.Name,
            area.Slug,
            area.ShortDescription,
            area.Description,
            area.CoverImageUrl,
            area.SortOrder,
            area.IsActive,
            area.CreatedAt,
            area.UpdatedAt);

    private static string? Validate(UpsertAreaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return "Naziv područja je obavezan.";
        }

        if (request.Name.Trim().Length > 128)
        {
            return "Naziv područja može imati najviše 128 znakova.";
        }

        if (request.ShortDescription?.Trim().Length > 512)
        {
            return "Kratki opis može imati najviše 512 znakova.";
        }

        if (request.CoverImageUrl?.Trim().Length > 512)
        {
            return "URL naslovne fotografije može imati najviše 512 znakova.";
        }

        return null;
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
