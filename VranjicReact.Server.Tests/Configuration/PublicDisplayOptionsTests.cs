using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Configuration;

namespace VranjicReact.Server.Tests.Configuration;

[TestClass]
public sealed class PublicDisplayOptionsTests
{
    [TestMethod]
    public void DefaultPreview_IsFiveAreas() => Assert.AreEqual(5, new PublicDisplayOptions().InitialAreaCount);

    [TestMethod]
    [DataRow(1, true)]
    [DataRow(8, true)]
    [DataRow(50, true)]
    [DataRow(0, false)]
    [DataRow(-1, false)]
    [DataRow(51, false)]
    public void PreviewCount_IsBounded(int count, bool valid) => Assert.AreEqual(valid, new PublicDisplayOptions { InitialAreaCount = count }.IsValid());

    [TestMethod]
    public void ContributionDefaults_AcceptExistingSlugMappingsAndRejectInvalidKeys()
    {
        var options = new PublicDisplayOptions {
            AreaTagSlugs = new() { ["vranjicke-mackare"] = ["mackare"] },
            ContentTagSlugs = new() { ["obavijest"] = ["novosti", "obavijesti"] } };
        Assert.IsTrue(options.IsValid());
        options.ContentTagSlugs["unknown-content"] = ["novosti"];
        Assert.IsFalse(options.IsValid());
        options.ContentTagSlugs.Clear();
        options.AreaTagSlugs["vranjicke-mackare"] = ["invalid tag"];
        Assert.IsFalse(options.IsValid());
    }
}
