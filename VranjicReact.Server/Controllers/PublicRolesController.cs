using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VranjicReact.Server.Utils;
using VranjicReact.Server.Contracts;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize]
public sealed class PublicRolesController : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public ActionResult<IReadOnlyList<PublicRoleDescription>> Get() => Ok(PublicRoleCatalog.Describe());
}
