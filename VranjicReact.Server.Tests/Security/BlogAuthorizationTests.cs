using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Controllers;
using VranjicReact.Server.Data;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Security;

[TestClass]
public sealed class BlogAuthorizationTests
{
    [TestMethod]
    public void MutationEndpoints_RequireExpectedPolicies()
    {
        AssertPolicy(nameof(BlogsController.Create), PolicyNames.ContentCreate);
        AssertPolicy(nameof(BlogsController.Update), PolicyNames.ContentCreate);
        AssertPolicy(nameof(BlogsController.Delete), PolicyNames.ContentManage);
        AssertPolicy(nameof(BlogsController.Verify), PolicyNames.ContentVerify);
    }

    [TestMethod]
    public void VerificationRoles_AreExplicitAndDoNotGrantContentManagement()
    {
        CollectionAssert.Contains(RoleNames.ContentVerify, RoleNames.SuperUser);
        CollectionAssert.Contains(RoleNames.ContentVerify, RoleNames.Administrator);
        CollectionAssert.Contains(RoleNames.ContentVerify, RoleNames.Verifier);
        CollectionAssert.DoesNotContain(RoleNames.ContentVerify, RoleNames.Moderator);
        CollectionAssert.DoesNotContain(RoleNames.ContentVerify, RoleNames.Korisnik);
        CollectionAssert.DoesNotContain(RoleNames.ContentManage, RoleNames.Verifier);
    }

    [TestMethod]
    public async Task ContributorCannotCreateDocumentedAndVerifiedPost()
    {
        await using var context = CreateContext();
        var controller = new BlogsController(
            context,
            new ContentClassificationService(context),
            new BlogContentValidationService(),
            new AreaModerationService(context),
            new EditorialWorkflowService(context, new AreaModerationService(context)),
            new ContentImageService(context))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, "contributor-id"),
                            new Claim(ClaimTypes.Role, RoleNames.Korisnik),
                        },
                        "Test")),
                },
            },
        };
        var request = new UpsertBlogPostRequest(
            "Naslov",
            "Sažetak",
            "Sadržaj",
            null,
            null,
            false,
            "DocumentedAndVerified",
            null,
            Sources:
            [
                new UpsertBlogPostSourceRequest(
                    "Arhivski dokument",
                    null,
                    2020,
                    "Document",
                    null,
                    null),
            ]);

        var result = await controller.Create(request, CancellationToken.None);

        Assert.IsInstanceOfType<ForbidResult>(result.Result);
    }

    [TestMethod]
    public void UpsertContract_DoesNotAcceptVerificationAuditFields()
    {
        Assert.IsNull(typeof(UpsertBlogPostRequest).GetProperty("VerifiedByUserId"));
        Assert.IsNull(typeof(UpsertBlogPostRequest).GetProperty("VerifiedAt"));
    }

    private static void AssertPolicy(string methodName, string policy)
    {
        var method = typeof(BlogsController).GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public);
        Assert.IsNotNull(method);
        var attribute = method.GetCustomAttribute<AuthorizeAttribute>();
        Assert.IsNotNull(attribute);
        Assert.AreEqual(policy, attribute.Policy);
    }

    private static VranjicContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<VranjicContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=VranjicBlogAuthorizationTests;Trusted_Connection=True")
            .Options;
        return new VranjicContext(options);
    }
}
