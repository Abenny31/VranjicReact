using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Utils;

[TestClass]
public sealed class SecurityConstantsTests
{
    [TestMethod]
    public void ConfiguredRoles_HaveUniqueIdsAndConsistentPortalAccess()
    {
        var roleIds = RoleNames.IdMap.Values.ToArray();

        Assert.AreEqual(roleIds.Length, roleIds.Distinct(StringComparer.Ordinal).Count());
        CollectionAssert.IsSubsetOf(RoleNames.ContentManage, RoleNames.ContentCreate);
        CollectionAssert.IsSubsetOf(RoleNames.ContentCreate, RoleNames.PortalAccess);
        CollectionAssert.Contains(RoleNames.SelfService, RoleNames.Verifier);
        CollectionAssert.Contains(RoleNames.ContentVerify, RoleNames.Verifier);
        CollectionAssert.DoesNotContain(RoleNames.PortalAccess, RoleNames.Verifier);
    }
}
