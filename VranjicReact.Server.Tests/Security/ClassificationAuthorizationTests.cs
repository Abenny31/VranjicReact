using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Controllers;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Security;

[TestClass]
public sealed class ClassificationAuthorizationTests
{
    [TestMethod]
    public void AreaAndTagMutationEndpoints_RequireClassificationManagePolicy()
    {
        AssertPolicy<AreasController>(nameof(AreasController.Create));
        AssertPolicy<AreasController>(nameof(AreasController.Update));
        AssertPolicy<AreasController>(nameof(AreasController.Delete));
        AssertPolicy<TagsController>(nameof(TagsController.Create));
        AssertPolicy<TagsController>(nameof(TagsController.Update));
        AssertPolicy<TagsController>(nameof(TagsController.Delete));
    }

    [TestMethod]
    public void ClassificationManagement_IsNotGrantedToContentContributors()
    {
        CollectionAssert.Contains(RoleNames.ContentManage, RoleNames.SuperUser);
        CollectionAssert.Contains(RoleNames.ContentManage, RoleNames.Administrator);
        CollectionAssert.DoesNotContain(RoleNames.ContentManage, RoleNames.Moderator);
        CollectionAssert.DoesNotContain(RoleNames.ContentManage, RoleNames.Korisnik);
    }

    private static void AssertPolicy<TController>(string methodName)
    {
        var method = typeof(TController).GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public);
        Assert.IsNotNull(method, $"Endpoint {typeof(TController).Name}.{methodName} nije pronađen.");

        var attribute = method.GetCustomAttribute<AuthorizeAttribute>();
        Assert.IsNotNull(attribute, $"Endpoint {typeof(TController).Name}.{methodName} nema autorizaciju.");
        Assert.AreEqual(PolicyNames.ClassificationManage, attribute.Policy);
    }
}
