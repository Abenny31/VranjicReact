using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Controllers;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Security;

[TestClass]
public sealed class ModerationAuthorizationTests
{
    [TestMethod]
    public void WorkflowEndpoints_RequireExpectedPolicies()
    {
        AssertPolicy(nameof(ModerationController.GetQueue), PolicyNames.ContentModerate);
        AssertPolicy(nameof(ModerationController.Submit), PolicyNames.ContentCreate);
        AssertPolicy(nameof(ModerationController.Decide), PolicyNames.ContentModerate);
        AssertPolicy(nameof(ModerationController.Publish), PolicyNames.ContentManage);
        AssertPolicy(nameof(ModerationController.Archive), PolicyNames.ContentManage);
    }

    [TestMethod]
    public void ClientContracts_DoNotAcceptAuditActorsOrStatuses()
    {
        Assert.IsNull(typeof(ModerationDecisionRequest).GetProperty("ActorUserId"));
        Assert.IsNull(typeof(ModerationDecisionRequest).GetProperty("NewStatus"));
        Assert.IsNull(typeof(UpsertNewsRequest).GetProperty("EditorialStatus"));
        Assert.IsNull(typeof(UpsertBlogPostRequest).GetProperty("EditorialStatus"));
    }

    private static void AssertPolicy(string methodName, string policy)
    {
        var method = typeof(ModerationController).GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public);
        Assert.IsNotNull(method);
        var attribute = method.GetCustomAttribute<AuthorizeAttribute>();
        Assert.IsNotNull(attribute);
        Assert.AreEqual(policy, attribute.Policy);
    }
}
