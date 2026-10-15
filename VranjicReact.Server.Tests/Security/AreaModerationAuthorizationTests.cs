using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Security;

[TestClass]
public sealed class AreaModerationAuthorizationTests
{
    [TestMethod]
    public void AssignedModerator_CanModerateOwnAreaOnly()
    {
        var assignedAreas = new HashSet<int> { 12 };

        Assert.IsTrue(AreaModerationService.CanModerate(
            "moderator", "author", 12, false, true, assignedAreas));
        Assert.IsFalse(AreaModerationService.CanModerate(
            "moderator", "author", 13, false, true, assignedAreas));
        Assert.IsFalse(AreaModerationService.CanModerate(
            "moderator", "author", null, false, true, assignedAreas));
    }

    [TestMethod]
    public void Reviewer_CannotApproveOwnContent()
    {
        Assert.IsFalse(AreaModerationService.CanModerate(
            "same-user", "same-user", 12, true, true, new HashSet<int> { 12 }));
    }

    [TestMethod]
    public void ContentManager_CanModerateAnyAreaExceptOwnContent()
    {
        Assert.IsTrue(AreaModerationService.CanModerate(
            "administrator", "author", null, true, false, new HashSet<int>()));
    }
}
