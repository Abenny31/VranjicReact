using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Data
{
    public class VranjicContext : IdentityDbContext<IdentityUser>
    {
        public VranjicContext(DbContextOptions<VranjicContext> options)
            : base(options)
        {
        }

        public DbSet<News> News { get; set; } = default!;
        public DbSet<GalleryAlbum> GalleryAlbums { get; set; } = default!;
        public DbSet<GalleryImage> GalleryImages { get; set; } = default!;
        public DbSet<ContactMessage> ContactMessages { get; set; } = default!;
        public DbSet<Area> Areas => Set<Area>();
        public DbSet<Tag> Tags => Set<Tag>();
        public DbSet<NewsTag> NewsTags => Set<NewsTag>();
        public DbSet<GalleryAlbumTag> GalleryAlbumTags => Set<GalleryAlbumTag>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<AnnouncementTag> AnnouncementTags => Set<AnnouncementTag>();
        public DbSet<BlogPost> BlogPosts => Set<BlogPost>();
        public DbSet<BlogPostTag> BlogPostTags => Set<BlogPostTag>();
        public DbSet<BlogPostSource> BlogPostSources => Set<BlogPostSource>();
        public DbSet<AreaModeratorAssignment> AreaModeratorAssignments => Set<AreaModeratorAssignment>();
        public DbSet<ContentModerationAction> ContentModerationActions => Set<ContentModerationAction>();

        public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            ChangeTracker.DetectChanges();
            var changed = ChangeTracker.Entries<ITranslatedEntity>()
                .Where(entry => entry.State == EntityState.Modified
                    && Services.ContentTranslationSchema.Fields(entry.Entity.GetType()).Keys
                        .Any(field => entry.Property(Services.ContentTranslationSchema.PropertyName(field)).IsModified))
                .ToList();
            foreach (var entry in changed)
            {
                await Services.ContentTranslationService.LoadAsync(this, entry.Entity, cancellationToken);
                var hash = Services.ContentTranslationSchema.Hash(Services.ContentTranslationSchema.Source(entry.Entity));
                foreach (var translation in entry.Entity.Translations)
                {
                    var stale = translation.SourceHash != hash;
                    if (translation.IsStale == stale) continue;
                    translation.IsStale = stale;
                    translation.Version = Guid.NewGuid();
                    translation.UpdatedAt = DateTime.UtcNow;
                }
            }
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            ContentTranslationMapping.Configure<News>(builder, "NewsTranslations");
            ContentTranslationMapping.Configure<BlogPost>(builder, "BlogPostTranslations");
            ContentTranslationMapping.Configure<Announcement>(builder, "AnnouncementTranslations");
            ContentTranslationMapping.Configure<GalleryAlbum>(builder, "GalleryAlbumTranslations");
            ContentTranslationMapping.Configure<GalleryImage>(builder, "GalleryImageTranslations");
            ContentTranslationMapping.Configure<Area>(builder, "AreaTranslations");
            ContentTranslationMapping.Configure<Tag>(builder, "TagTranslations");

            builder.Entity<News>(entity =>
            {
                entity.HasIndex(n => n.Slug).IsUnique();
                entity.Property(n => n.Slug).HasMaxLength(128);
                entity.Property(n => n.Title).HasMaxLength(200);
                entity.Property(n => n.Excerpt).HasMaxLength(512);
                entity.Property(n => n.HeroImageUrl).HasMaxLength(512);
                entity.Property(n => n.Source).HasMaxLength(64);
                entity.Property(n => n.CreatedByUserId).HasMaxLength(450);
                entity.Property(n => n.EditorialStatus).HasConversion<string>().HasMaxLength(32);
                entity.Property(n => n.RowVersion).IsRowVersion();
                entity.HasIndex(n => n.GalleryAlbumId)
                      .HasFilter("[GalleryAlbumId] IS NOT NULL");
                entity.HasOne(n => n.GalleryAlbum)
                      .WithMany()
                      .HasForeignKey(n => n.GalleryAlbumId)
                      .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne(n => n.GalleryImage)
                      .WithMany()
                      .HasForeignKey(n => n.GalleryImageId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.Property(n => n.TimePerspective)
                      .HasConversion<string>()
                      .HasMaxLength(16);
                entity.HasIndex(n => n.AreaId);
                entity.HasIndex(n => n.TimePerspective);
                entity.HasIndex(n => n.EditorialStatus);
                entity.HasOne(n => n.Area)
                      .WithMany(a => a.News)
                      .HasForeignKey(n => n.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<IdentityUser>()
                      .WithMany()
                      .HasForeignKey(n => n.CreatedByUserId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            builder.Entity<GalleryAlbum>(entity =>
            {
                entity.Property(a => a.EditorialStatus).HasConversion<string>().HasMaxLength(32);
                entity.Property(a => a.RowVersion).IsRowVersion();
                entity.HasIndex(a => a.EditorialStatus);
                entity.HasIndex(a => a.EventDate);
                entity.HasOne<IdentityUser>().WithMany().HasForeignKey(a => a.CreatedByUserId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.Property(a => a.Title).HasMaxLength(200);
                entity.Property(a => a.Description).HasMaxLength(512);
                entity.Property(a => a.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
                entity.Property(a => a.TimePerspective)
                      .HasConversion<string>()
                      .HasMaxLength(16);
                entity.HasIndex(a => a.AreaId);
                entity.HasIndex(a => a.TimePerspective);
                entity.HasOne(a => a.Area)
                      .WithMany(area => area.GalleryAlbums)
                      .HasForeignKey(a => a.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<GalleryImage>(entity =>
            {
                entity.Property(g => g.MediaType)
                      .HasConversion<string>()
                      .HasMaxLength(16);
                entity.Property(g => g.Title).HasMaxLength(200);
                entity.Property(g => g.Description).HasMaxLength(512);
                entity.Property(g => g.ContentType).HasMaxLength(128);
                entity.Property(g => g.FileName).HasMaxLength(260);
                entity.Property(g => g.Data).HasColumnType("varbinary(max)");

                entity.HasOne(g => g.Album)
                      .WithMany(a => a.Images)
                      .HasForeignKey(g => g.AlbumId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<ContactMessage>(entity =>
            {
                entity.Property(c => c.Name).HasMaxLength(128);
                entity.Property(c => c.Email).HasMaxLength(256);
                entity.Property(c => c.Message).HasMaxLength(4096);
            });

            builder.Entity<Area>(entity =>
            {
                entity.Property(a => a.Name).HasMaxLength(128);
                entity.Property(a => a.Slug).HasMaxLength(128);
                entity.Property(a => a.ShortDescription).HasMaxLength(512);
                entity.Property(a => a.CoverImageUrl).HasMaxLength(512);
                entity.HasIndex(a => a.Slug).IsUnique();
                entity.HasIndex(a => new { a.IsActive, a.SortOrder });
            });

            builder.Entity<Tag>(entity =>
            {
                entity.Property(t => t.Name).HasMaxLength(100);
                entity.Property(t => t.Slug).HasMaxLength(100);
                entity.HasIndex(t => t.Slug).IsUnique();
                entity.HasIndex(t => new { t.IsActive, t.Name });
            });

            builder.Entity<NewsTag>(entity =>
            {
                entity.HasKey(nt => new { nt.NewsId, nt.TagId });
                entity.HasOne(nt => nt.News)
                      .WithMany(n => n.NewsTags)
                      .HasForeignKey(nt => nt.NewsId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(nt => nt.Tag)
                      .WithMany(t => t.NewsTags)
                      .HasForeignKey(nt => nt.TagId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<GalleryAlbumTag>(entity =>
            {
                entity.HasKey(at => new { at.GalleryAlbumId, at.TagId });
                entity.HasOne(at => at.GalleryAlbum)
                      .WithMany(a => a.GalleryAlbumTags)
                      .HasForeignKey(at => at.GalleryAlbumId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(at => at.Tag)
                      .WithMany(t => t.GalleryAlbumTags)
                      .HasForeignKey(at => at.TagId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<Announcement>(entity =>
            {
                entity.Property(a => a.EditorialStatus).HasConversion<string>().HasMaxLength(32);
                entity.Property(a => a.RowVersion).IsRowVersion();
                entity.HasIndex(a => a.EditorialStatus);
                entity.Property(a => a.Slug).HasMaxLength(128);
                entity.Property(a => a.Title).HasMaxLength(200);
                entity.Property(a => a.Summary).HasMaxLength(512);
                entity.Property(a => a.Importance)
                      .HasConversion<string>()
                      .HasMaxLength(16);
                entity.Property(a => a.ActionLabel).HasMaxLength(100);
                entity.Property(a => a.ActionUrl).HasMaxLength(1024);
                entity.Property(a => a.CreatedByUserId).HasMaxLength(450);
                entity.HasIndex(a => a.Slug).IsUnique();
                entity.HasIndex(a => a.AreaId);
                entity.HasIndex(a => new { a.PublishedAt, a.StartsAt, a.ExpiresAt });
                entity.HasIndex(a => a.Importance);
                entity.HasOne(a => a.Area)
                      .WithMany(area => area.Announcements)
                      .HasForeignKey(a => a.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<IdentityUser>()
                      .WithMany()
                      .HasForeignKey(a => a.CreatedByUserId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            builder.Entity<AnnouncementTag>(entity =>
            {
                entity.HasKey(at => new { at.AnnouncementId, at.TagId });
                entity.HasOne(at => at.Announcement)
                      .WithMany(a => a.AnnouncementTags)
                      .HasForeignKey(at => at.AnnouncementId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(at => at.Tag)
                      .WithMany(t => t.AnnouncementTags)
                      .HasForeignKey(at => at.TagId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<BlogPost>(entity =>
            {
                entity.Property(post => post.Slug).HasMaxLength(128);
                entity.Property(post => post.Title).HasMaxLength(200);
                entity.Property(post => post.Excerpt).HasMaxLength(512);
                entity.Property(post => post.HeroImageUrl).HasMaxLength(512);
                entity.Property(post => post.TimePerspective)
                      .HasConversion<string>()
                      .HasMaxLength(16);
                entity.Property(post => post.Origin)
                      .HasConversion<string>()
                      .HasMaxLength(32);
                entity.Property(post => post.VerifiedByUserId).HasMaxLength(450);
                entity.Property(post => post.CreatedByUserId).HasMaxLength(450);
                entity.Property(post => post.EditorialStatus).HasConversion<string>().HasMaxLength(32);
                entity.Property(post => post.RowVersion).IsRowVersion();
                entity.HasIndex(post => post.Slug).IsUnique();
                entity.HasIndex(post => post.AreaId);
                entity.HasIndex(post => post.TimePerspective);
                entity.HasIndex(post => post.Origin);
                entity.HasIndex(post => post.PublishedAt);
                entity.HasIndex(post => post.EditorialStatus);
                entity.HasOne(post => post.Area)
                      .WithMany(area => area.BlogPosts)
                      .HasForeignKey(post => post.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<IdentityUser>()
                      .WithMany()
                      .HasForeignKey(post => post.CreatedByUserId)
                      .OnDelete(DeleteBehavior.SetNull);
                entity.HasOne<IdentityUser>()
                      .WithMany()
                      .HasForeignKey(post => post.VerifiedByUserId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<BlogPostTag>(entity =>
            {
                entity.HasKey(link => new { link.BlogPostId, link.TagId });
                entity.HasOne(link => link.BlogPost)
                      .WithMany(post => post.BlogPostTags)
                      .HasForeignKey(link => link.BlogPostId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(link => link.Tag)
                      .WithMany(tag => tag.BlogPostTags)
                      .HasForeignKey(link => link.TagId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<BlogPostSource>(entity =>
            {
                entity.Property(source => source.Title).HasMaxLength(300);
                entity.Property(source => source.Author).HasMaxLength(200);
                entity.Property(source => source.Type)
                      .HasConversion<string>()
                      .HasMaxLength(16);
                entity.Property(source => source.Url).HasMaxLength(1024);
                entity.Property(source => source.Note).HasMaxLength(1000);
                entity.HasIndex(source => source.BlogPostId);
                entity.HasOne(source => source.BlogPost)
                      .WithMany(post => post.Sources)
                      .HasForeignKey(source => source.BlogPostId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<AreaModeratorAssignment>(entity =>
            {
                entity.Property(assignment => assignment.UserId).HasMaxLength(450);
                entity.Property(assignment => assignment.AssignedByUserId).HasMaxLength(450);
                entity.HasIndex(assignment => new { assignment.UserId, assignment.AreaId }).IsUnique();
                entity.HasIndex(assignment => new { assignment.AreaId, assignment.IsActive, assignment.EndsAt });
                entity.HasOne(assignment => assignment.Area)
                      .WithMany()
                      .HasForeignKey(assignment => assignment.AreaId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<IdentityUser>()
                      .WithMany()
                      .HasForeignKey(assignment => assignment.UserId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<IdentityUser>()
                      .WithMany()
                      .HasForeignKey(assignment => assignment.AssignedByUserId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            builder.Entity<ContentModerationAction>(entity =>
            {
                entity.Property(action => action.Action).HasConversion<string>().HasMaxLength(32);
                entity.Property(action => action.PreviousStatus).HasConversion<string>().HasMaxLength(32);
                entity.Property(action => action.NewStatus).HasConversion<string>().HasMaxLength(32);
                entity.Property(action => action.ActorUserId).HasMaxLength(450);
                entity.Property(action => action.Comment).HasMaxLength(1000);
                entity.HasIndex(action => action.NewsId);
                entity.HasIndex(action => action.BlogPostId);
                entity.HasIndex(action => action.CreatedAt);
                entity.ToTable(table => table.HasCheckConstraint(
                    "CK_ContentModerationActions_ExactlyOneContent",
                    "(CASE WHEN [NewsId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [BlogPostId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [AnnouncementId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [GalleryAlbumId] IS NULL THEN 0 ELSE 1 END) = 1"));
                entity.HasOne(action => action.Announcement).WithMany(a => a.ModerationActions)
                      .HasForeignKey(action => action.AnnouncementId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(action => action.GalleryAlbum).WithMany(a => a.ModerationActions)
                      .HasForeignKey(action => action.GalleryAlbumId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(action => action.News)
                      .WithMany(news => news.ModerationActions)
                      .HasForeignKey(action => action.NewsId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(action => action.BlogPost)
                      .WithMany(post => post.ModerationActions)
                      .HasForeignKey(action => action.BlogPostId)
                      .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne<IdentityUser>()
                      .WithMany()
                      .HasForeignKey(action => action.ActorUserId)
                      .OnDelete(DeleteBehavior.SetNull);
            });
        }
    }
}
