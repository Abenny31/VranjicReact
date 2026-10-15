using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/my-content")]
[Authorize(Policy = PolicyNames.ContentCreate)]
public sealed class MyContentController(MyContentService content) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<MyContentPage>> Get([FromQuery] int page = 1, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(User.FindFirstValue(ClaimTypes.NameIdentifier))) return Unauthorized();
        if (page is < 1 or > 10000) return BadRequest("Neispravna stranica.");
        return Ok(await content.GetAsync(User, page, ct));
    }
}
