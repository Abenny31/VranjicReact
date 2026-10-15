using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Utils;

[TestClass]
public sealed class PublicRoleCatalogTests
{
    [TestMethod]
    public void PublicCatalog_OmitsSuperUserAndListsAllOtherExistingRoles()
    {
        var roles = PublicRoleCatalog.Describe();
        CollectionAssert.AreEquivalent(RoleNames.IdMap.Keys.Where(name => name != RoleNames.SuperUser).ToArray(), roles.Select(role => role.Name).ToArray());
        Assert.IsFalse(roles.SelectMany(role => role.Capabilities).Any(text => text.Contains(RoleNames.SuperUser)));
    }

    [TestMethod]
    public void Descriptions_KeepVerificationSeparateFromModerationAndPublishing()
    {
        var roles = PublicRoleCatalog.Describe().ToDictionary(role => role.Name);
        var verifier = roles[RoleNames.Verifier].Capabilities;
        Assert.IsTrue(verifier.Any(text => text.Contains("neobjavljene priče")));
        Assert.IsFalse(verifier.Any(text => text.StartsWith("Izrada") || text.StartsWith("Objavljivanje")));
        var moderator = roles[RoleNames.Moderator].Capabilities;
        Assert.IsTrue(moderator.Any(text => text.Contains("aktivno dodijeljenim područjima") && text.Contains("Ne odobrava vlastiti")));
        Assert.IsFalse(moderator.Any(text => text.Contains("označavanje sadržaja kao dokumentiranog")));
        Assert.HasCount(1, roles[RoleNames.Gost].Capabilities);
    }
}
