using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Contracts;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/public-settings")]
[AllowAnonymous]
public sealed class PublicSettingsController(IOptionsSnapshot<PublicDisplayOptions> options) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public ActionResult<PublicDisplayDto> Get() => new PublicDisplayDto(options.Value.InitialAreaCount,
        options.Value.AreaTagSlugs, options.Value.ContentTagSlugs);
}
