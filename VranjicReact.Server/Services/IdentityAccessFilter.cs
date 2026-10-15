using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using VranjicReact.Server.Configuration;

namespace VranjicReact.Server.Services;

public sealed class IdentityAccessFilter(IOptions<AccountEmailOptions> email) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var route = (context.HttpContext.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText?.TrimEnd('/');
        // Public self-registration stays closed, independently of mail delivery.
        if (route == "/register") return Results.Json(new { message = "Javna registracija nije omogućena." }, statusCode: 403);
        if (!email.Value.Enabled && route is "/forgotPassword" or "/resetPassword" or "/resendConfirmationEmail" or "/confirmEmail")
            return Results.Json(new { message = "Slanje e-maila nije omogućeno." }, statusCode: 503);
        return await next(context);
    }
}
