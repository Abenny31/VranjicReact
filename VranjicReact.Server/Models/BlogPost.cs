using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Models;

public enum ContentOrigin
{
    DocumentedAndVerified = 1,
    PersonalTestimony = 2,
    OralTradition = 3,
    AuthorCommentary = 4,
}

public enum ContentSourceType
{
    Book = 1,
    Document = 2,
    Archive = 3,
    Url = 4,
}

public class BlogPost : IEditorialContent, ITranslatedEntity
{
    public ICollection<ContentTranslation> Translations { get; set; } = new List<ContentTranslation>();

    public int Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string Slug { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(512)]
    public string Excerpt { get; set; } = string.Empty;

    [Required]
    public string Body { get; set; } = string.Empty;

    [MaxLength(512)]
    public string? HeroImageUrl { get; set; }

    public DateTime? PublishedAt { get; set; }

    public bool IsFeatured { get; set; }

    public int? AreaId { get; set; }

    public Area? Area { get; set; }

    public ContentTimePerspective? TimePerspective { get; set; }

    public ContentOrigin? Origin { get; set; }

    [MaxLength(450)]
    public string? VerifiedByUserId { get; set; }

    public DateTime? VerifiedAt { get; set; }

    [MaxLength(450)]
    public string? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public EditorialStatus? EditorialStatus { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public ICollection<BlogPostTag> BlogPostTags { get; set; } = new List<BlogPostTag>();

    public ICollection<BlogPostSource> Sources { get; set; } = new List<BlogPostSource>();

    public ICollection<ContentModerationAction> ModerationActions { get; set; } = new List<ContentModerationAction>();
}

public class BlogPostSource
{
    public int Id { get; set; }

    public int BlogPostId { get; set; }

    public required BlogPost BlogPost { get; set; }

    [Required]
    [MaxLength(300)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Author { get; set; }

    public int? Year { get; set; }

    public ContentSourceType Type { get; set; }

    [MaxLength(1024)]
    public string? Url { get; set; }

    [MaxLength(1000)]
    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
