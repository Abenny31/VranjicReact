using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class GalleryMediaValidationTests
{
    [TestMethod]
    public void PngSignature_IsAcceptedOnlyWithMatchingType()
    {
        byte[] header = [137, 80, 78, 71, 13, 10, 26, 10];
        Assert.IsTrue(GalleryMediaValidation.IsSupported(GalleryMediaType.Image, "image/png", header));
        Assert.IsFalse(GalleryMediaValidation.IsSupported(GalleryMediaType.Video, "image/png", header));
        Assert.IsFalse(GalleryMediaValidation.IsSupported(GalleryMediaType.Image, "image/jpeg", header));
    }

    [TestMethod]
    public void HtmlAndSvg_AreRejectedEvenWithForgedType()
    {
        Assert.IsFalse(GalleryMediaValidation.IsSupported(GalleryMediaType.Image, "image/png", "<html>"u8));
        Assert.IsFalse(GalleryMediaValidation.IsSupported(GalleryMediaType.Image, "image/svg+xml", "<svg/>"u8));
    }
}
