using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Tests.Data;

[TestClass]
public sealed class ClassificationModelTests
{
    [TestMethod]
    public void ExistingContentAreaLinks_AreOptionalAndRestrictedOnDelete()
    {
        using var context = CreateContext();

        AssertOptionalRestrictedForeignKey<News>(context, nameof(News.AreaId));
        AssertOptionalRestrictedForeignKey<GalleryAlbum>(context, nameof(GalleryAlbum.AreaId));
        AssertOptionalRestrictedForeignKey<Announcement>(context, nameof(Announcement.AreaId));
        AssertOptionalRestrictedForeignKey<BlogPost>(context, nameof(BlogPost.AreaId));
    }

    [TestMethod]
    public void AreaAndTagSlugs_AreUnique()
    {
        using var context = CreateContext();

        AssertUniqueIndex<Area>(context, nameof(Area.Slug));
        AssertUniqueIndex<Tag>(context, nameof(Tag.Slug));
        AssertUniqueIndex<Announcement>(context, nameof(Announcement.Slug));
        AssertUniqueIndex<BlogPost>(context, nameof(BlogPost.Slug));
    }

    [TestMethod]
    public void ClassificationJoinTables_UseCompositeKeys()
    {
        using var context = CreateContext();

        var newsTagKey = context.Model.FindEntityType(typeof(NewsTag))?.FindPrimaryKey();
        var albumTagKey = context.Model.FindEntityType(typeof(GalleryAlbumTag))?.FindPrimaryKey();
        var announcementTagKey = context.Model.FindEntityType(typeof(AnnouncementTag))?.FindPrimaryKey();
        var blogPostTagKey = context.Model.FindEntityType(typeof(BlogPostTag))?.FindPrimaryKey();

        CollectionAssert.AreEqual(
            new[] { nameof(NewsTag.NewsId), nameof(NewsTag.TagId) },
            newsTagKey?.Properties.Select(property => property.Name).ToArray());
        CollectionAssert.AreEqual(
            new[] { nameof(GalleryAlbumTag.GalleryAlbumId), nameof(GalleryAlbumTag.TagId) },
            albumTagKey?.Properties.Select(property => property.Name).ToArray());
        CollectionAssert.AreEqual(
            new[] { nameof(AnnouncementTag.AnnouncementId), nameof(AnnouncementTag.TagId) },
            announcementTagKey?.Properties.Select(property => property.Name).ToArray());
        CollectionAssert.AreEqual(
            new[] { nameof(BlogPostTag.BlogPostId), nameof(BlogPostTag.TagId) },
            blogPostTagKey?.Properties.Select(property => property.Name).ToArray());
    }

    [TestMethod]
    public void BlogSources_AreOwnedByBlogPostAndCascadeOnDelete()
    {
        using var context = CreateContext();

        var sourceEntity = context.Model.FindEntityType(typeof(BlogPostSource));
        var foreignKey = sourceEntity?.GetForeignKeys().SingleOrDefault(candidate =>
            candidate.Properties.Any(property => property.Name == nameof(BlogPostSource.BlogPostId)));

        Assert.IsNotNull(foreignKey);
        Assert.AreEqual(DeleteBehavior.Cascade, foreignKey.DeleteBehavior);
    }

    [TestMethod]
    public void BlogVerificationUserLink_DoesNotCreateSecondCascadePath()
    {
        using var context = CreateContext();

        var blogEntity = context.Model.FindEntityType(typeof(BlogPost));
        var foreignKey = blogEntity?.GetForeignKeys().SingleOrDefault(candidate =>
            candidate.Properties.Any(property => property.Name == nameof(BlogPost.VerifiedByUserId)));

        Assert.IsNotNull(foreignKey);
        Assert.AreEqual(DeleteBehavior.Restrict, foreignKey.DeleteBehavior);
    }

    [TestMethod]
    public void EditorialContent_UsesRowVersionConcurrencyTokens()
    {
        using var context = CreateContext();

        Assert.IsTrue(context.Model.FindEntityType(typeof(News))?.FindProperty(nameof(News.RowVersion))?.IsConcurrencyToken);
        Assert.IsTrue(context.Model.FindEntityType(typeof(BlogPost))?.FindProperty(nameof(BlogPost.RowVersion))?.IsConcurrencyToken);
        Assert.IsTrue(context.Model.FindEntityType(typeof(Announcement))?.FindProperty(nameof(Announcement.RowVersion))?.IsConcurrencyToken);
        Assert.IsTrue(context.Model.FindEntityType(typeof(GalleryAlbum))?.FindProperty(nameof(GalleryAlbum.RowVersion))?.IsConcurrencyToken);
    }

    [TestMethod]
    public void ModeratorAssignment_IsUniquePerUserAndArea()
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(AreaModeratorAssignment));
        var index = entityType?.GetIndexes().SingleOrDefault(candidate =>
            candidate.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(AreaModeratorAssignment.UserId), nameof(AreaModeratorAssignment.AreaId) }));

        Assert.IsNotNull(index);
        Assert.IsTrue(index.IsUnique);
    }

    [TestMethod]
    public void ModerationAudit_UsesRestrictedTypedContentLinks()
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(ContentModerationAction));
        var contentLinks = entityType?.GetForeignKeys()
            .Where(candidate => candidate.Properties.Any(property =>
                property.Name is nameof(ContentModerationAction.NewsId) or nameof(ContentModerationAction.BlogPostId)
                    or nameof(ContentModerationAction.AnnouncementId) or nameof(ContentModerationAction.GalleryAlbumId)))
            .ToList();

        Assert.AreEqual(4, contentLinks?.Count);
        Assert.IsTrue(contentLinks!.All(link => link.DeleteBehavior == DeleteBehavior.Restrict));
    }

    private static void AssertOptionalRestrictedForeignKey<TEntity>(VranjicContext context, string propertyName)
    {
        var entityType = context.Model.FindEntityType(typeof(TEntity));
        var property = entityType?.FindProperty(propertyName);
        var foreignKey = entityType?.GetForeignKeys().SingleOrDefault(candidate =>
            candidate.Properties.Any(candidateProperty => candidateProperty.Name == propertyName));

        Assert.IsNotNull(property);
        Assert.IsTrue(property.IsNullable);
        Assert.IsNotNull(foreignKey);
        Assert.AreEqual(DeleteBehavior.Restrict, foreignKey.DeleteBehavior);
    }

    private static void AssertUniqueIndex<TEntity>(VranjicContext context, string propertyName)
    {
        var entityType = context.Model.FindEntityType(typeof(TEntity));
        var index = entityType?.GetIndexes().SingleOrDefault(candidate =>
            candidate.Properties.Count == 1 && candidate.Properties[0].Name == propertyName);

        Assert.IsNotNull(index);
        Assert.IsTrue(index.IsUnique);
    }

    private static VranjicContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<VranjicContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=VranjicModelTests;Trusted_Connection=True")
            .Options;

        return new VranjicContext(options);
    }
}
