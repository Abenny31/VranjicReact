using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Tests.Data;

[TestClass]
public sealed class ContentTranslationModelTests
{
    [TestMethod]
    public void TranslationTables_HaveLanguageKeys_RealCascadeForeignKeys_AndExplicitLoading()
    {
        using var db = new VranjicContext(new DbContextOptionsBuilder<VranjicContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=true").Options);
        foreach (var type in new[] { typeof(News), typeof(BlogPost), typeof(Announcement), typeof(GalleryAlbum), typeof(GalleryImage), typeof(Area), typeof(Tag) })
        {
            var owner = db.Model.FindEntityType(type);
            Assert.IsNotNull(owner);
            var navigation = owner.FindNavigation(nameof(ITranslatedEntity.Translations));
            Assert.IsNotNull(navigation);
            Assert.IsFalse(navigation.IsEagerLoaded);
            var translation = navigation.TargetEntityType;
            Assert.AreEqual(type.Name + "Translations", translation.GetTableName());
            CollectionAssert.AreEqual(new[] { "ContentId", "Language" }, translation.FindPrimaryKey()!.Properties.Select(p => p.Name).ToArray());
            Assert.AreEqual(DeleteBehavior.Cascade, navigation.ForeignKey.DeleteBehavior);
            Assert.IsTrue(translation.FindProperty(nameof(ContentTranslation.Version))!.IsConcurrencyToken);
        }
        Assert.IsFalse(db.News.AsNoTracking().ToQueryString().Contains("NewsTranslations", StringComparison.Ordinal));
        Assert.IsFalse(db.GalleryImages.AsNoTracking().ToQueryString().Contains("GalleryImageTranslations", StringComparison.Ordinal));
    }
}
