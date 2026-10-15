using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Controllers;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Authorization;

[TestClass]
public sealed class RolesEndpointAuthorizationTests
{
    [TestMethod]
    [DataRow(false, false)]
    [DataRow(true, true)]
    public async Task EndpointPolicy_RequiresAuthenticationWithoutRequiringAnEditorialRole(bool authenticated, bool allowed)
    {
        // Evaluate the actual endpoint metadata without starting a host or registering a database.
        var controller = typeof(PublicRolesController);
        var action = controller.GetMethod(nameof(PublicRolesController.Get))
            ?? throw new InvalidOperationException("Roles action was not found.");
        var metadata = controller.GetCustomAttributes(inherit: true).Concat(action.GetCustomAttributes(inherit: true)).ToArray();
        Assert.IsFalse(metadata.OfType<IAllowAnonymous>().Any());
        var authorization = metadata.OfType<IAuthorizeData>().ToArray();
        Assert.IsNotEmpty(authorization);

        using var services = new ServiceCollection().AddLogging().AddAuthorizationCore().BuildServiceProvider();
        var policy = await AuthorizationPolicy.CombineAsync(services.GetRequiredService<IAuthorizationPolicyProvider>(), authorization)
            ?? throw new InvalidOperationException("Roles authorization policy was not found.");
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.Role, authenticated ? RoleNames.Gost : RoleNames.Administrator)],
            authenticated ? "test" : null));
        var result = await services.GetRequiredService<IAuthorizationService>().AuthorizeAsync(user, null, policy);
        Assert.AreEqual(allowed, result.Succeeded);
    }
}
