using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/updates")]
public sealed class UpdatesController(UpdatesService updates, EditorialUpdatesService editorialUpdates) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<UpdatesPageDto>> Get([FromQuery] string? kind, [FromQuery] string? area,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] int? tagId = null, CancellationToken ct = default)
    {
        if (kind is not null and not "News" and not "Announcement") return BadRequest("Vrsta mora biti News ili Announcement.");
        if (page is < 1 or > 10000 || pageSize is < 1 or > 100) return BadRequest("Neispravna stranica ili veličina stranice.");
        if (tagId is <= 0) return BadRequest("Oznaka nije valjana.");
        return Ok(await updates.GetAsync(kind, string.IsNullOrWhiteSpace(area) ? null : area.Trim().ToLowerInvariant(), page, pageSize, tagId, ct));
    }

    [HttpGet("editorial")]
    [Authorize(Policy = PolicyNames.ContentCreate)]
    public async Task<ActionResult<EditorialUpdatesPageDto>> GetEditorial([FromQuery] string? kind,
        [FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] int? tagId = null, CancellationToken ct = default)
    {
        if (kind is not null and not "News" and not "Announcement") return BadRequest("Vrsta mora biti News ili Announcement.");
        if (page is < 1 or > 10000 || pageSize is < 1 or > 100) return BadRequest("Neispravna stranica ili veličina stranice.");
        if (search?.Length > 200) return BadRequest("Pretraga može imati najviše 200 znakova.");
        if (tagId is <= 0) return BadRequest("Oznaka nije valjana.");
        EditorialStatus? parsedStatus = null;
        if (status is not null)
        {
            if (!Enum.GetNames<EditorialStatus>().Contains(status, StringComparer.Ordinal)
                || !Enum.TryParse<EditorialStatus>(status, out var value)) return BadRequest("Nepoznat urednički status.");
            parsedStatus = value;
        }
        return Ok(await editorialUpdates.GetAsync(User, kind, parsedStatus, search?.Trim(), page, pageSize, tagId, ct));
    }
}
