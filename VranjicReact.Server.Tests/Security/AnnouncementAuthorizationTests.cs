using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Controllers;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Security;

[TestClass]
public sealed class AnnouncementAuthorizationTests
{
    [TestMethod]
    public void Create_RequiresContentCreatePolicy()
    {
        AssertPolicy(nameof(AnnouncementsController.Create), PolicyNames.ContentCreate);
    }

    [TestMethod]
    public void UpdateAndDelete_RequireContentManagePolicy()
    {
        AssertPolicy(nameof(AnnouncementsController.Update), PolicyNames.ContentCreate);
        AssertPolicy(nameof(AnnouncementsController.Delete), PolicyNames.ContentManage);
    }

    [TestMethod]
    public void PublicReadEndpoints_DoNotRequireAuthorization()
    {
        Assert.IsNull(GetMethod(nameof(AnnouncementsController.GetAll)).GetCustomAttribute<AuthorizeAttribute>());
        Assert.IsNull(GetMethod(nameof(AnnouncementsController.GetOne)).GetCustomAttribute<AuthorizeAttribute>());
    }

    private static void AssertPolicy(string methodName, string policy)
    {
        var attribute = GetMethod(methodName).GetCustomAttribute<AuthorizeAttribute>();
        Assert.IsNotNull(attribute);
        Assert.AreEqual(policy, attribute.Policy);
    }

    private static MethodInfo GetMethod(string methodName) =>
        typeof(AnnouncementsController).GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public)
        ?? throw new AssertFailedException($"Endpoint AnnouncementsController.{methodName} nije pronađen.");
}
