using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Utils;

[TestClass]
public sealed class SlugHelperTests
{
    [TestMethod]
    [DataRow("Vranjička škola", "vranjicka-skola")]
    [DataRow("  Jučer   Danas -- Sutra  ", "jucer-danas-sutra")]
    [DataRow("DFB_Vranjic!", "dfb-vranjic")]
    public void GenerateSlug_NormalizesExpectedCharacters(string input, string expected)
    {
        var result = SlugHelper.GenerateSlug(input);

        Assert.AreEqual(expected, result);
    }

    [TestMethod]
    public void GenerateSlug_WhenValueIsBlank_ReturnsGuidIdentifierShape()
    {
        var result = SlugHelper.GenerateSlug("   ");

        Assert.AreEqual(32, result.Length);
        Assert.IsTrue(Guid.TryParseExact(result, "N", out _));
    }
}
