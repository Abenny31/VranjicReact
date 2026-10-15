using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Contracts;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/public-contact")]
[AllowAnonymous]
public sealed class PublicContactController(IOptionsSnapshot<PublicContactOptions> options) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public ActionResult<PublicContactDto> Get()
    {
        var contact = options.Value;
        // Explicit public contract: never return configuration or account-email options wholesale.
        return new PublicContactDto(contact.Address.Trim(), contact.Email.Trim(), contact.SupportEmail.Trim(),
            contact.Phone.Trim(), string.IsNullOrWhiteSpace(contact.FacebookUrl) ? string.Empty : new Uri(contact.FacebookUrl.Trim()).AbsoluteUri);
    }
}
