using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class BlogContentValidationServiceTests
{
    private readonly BlogContentValidationService _service = new();

    [TestMethod]
    public void DocumentedContentWithoutSources_IsRejected()
    {
        var result = _service.Validate(CreateRequest("DocumentedAndVerified", []));

        Assert.IsFalse(result.IsValid);
    }

    [TestMethod]
    public void UnsafeSourceUrl_IsRejected()
    {
        var result = _service.Validate(CreateRequest(
            "PersonalTestimony",
            [new UpsertBlogPostSourceRequest("Izvor", null, null, "Url", "javascript:alert(1)", null)]));

        Assert.IsFalse(result.IsValid);
    }

    [TestMethod]
    public void ValidDocumentedSource_IsParsedToTypedValues()
    {
        var result = _service.Validate(CreateRequest(
            "DocumentedAndVerified",
            [new UpsertBlogPostSourceRequest("Knjiga o Vranjicu", "Autor", 2020, "Book", null, null)]));

        Assert.IsTrue(result.IsValid);
        Assert.AreEqual(ContentOrigin.DocumentedAndVerified, result.Origin);
        Assert.AreEqual(ContentSourceType.Book, result.Sources.Single().Type);
    }

    private static UpsertBlogPostRequest CreateRequest(
        string origin,
        IReadOnlyList<UpsertBlogPostSourceRequest> sources) =>
        new(
            "Naslov",
            "Sažetak",
            "Sadržaj",
            null,
            null,
            false,
            origin,
            null,
            Sources: sources);
}
