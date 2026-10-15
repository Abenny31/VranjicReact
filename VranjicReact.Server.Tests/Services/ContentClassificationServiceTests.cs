using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class ContentClassificationServiceTests
{
    [TestMethod]
    public async Task ResolveAsync_WithSupportedPerspective_ReturnsParsedSelection()
    {
        await using var context = CreateContext();
        var service = new ContentClassificationService(context);

        var result = await service.ResolveAsync(null, "Jucer", Array.Empty<int>(), CancellationToken.None);

        Assert.IsTrue(result.IsValid);
        Assert.AreEqual(ContentTimePerspective.Jucer, result.TimePerspective);
        Assert.AreEqual(0, result.Tags.Count);
    }

    [TestMethod]
    public async Task ResolveAsync_WithUnsupportedPerspective_ReturnsValidationError()
    {
        await using var context = CreateContext();
        var service = new ContentClassificationService(context);

        var result = await service.ResolveAsync(null, "Proslost", Array.Empty<int>(), CancellationToken.None);

        Assert.IsFalse(result.IsValid);
        Assert.IsNotNull(result.ValidationError);
    }

    private static VranjicContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<VranjicContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=VranjicClassificationTests;Trusted_Connection=True")
            .Options;

        return new VranjicContext(options);
    }
}
