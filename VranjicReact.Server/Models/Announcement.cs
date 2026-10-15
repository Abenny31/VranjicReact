using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Models;

public enum AnnouncementImportance
{
    Normal = 1,
    Important = 2,
    Urgent = 3,
}

public class Announcement : IEditorialContent, ITranslatedEntity
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
    public string Summary { get; set; } = string.Empty;

    [Required]
    public string Body { get; set; } = string.Empty;

    public DateTime StartsAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime? PublishedAt { get; set; }

    public AnnouncementImportance Importance { get; set; } = AnnouncementImportance.Normal;

    [MaxLength(100)]
    public string? ActionLabel { get; set; }

    [MaxLength(1024)]
    public string? ActionUrl { get; set; }

    public int? AreaId { get; set; }

    public Area? Area { get; set; }

    public ICollection<AnnouncementTag> AnnouncementTags { get; set; } = new List<AnnouncementTag>();

    [MaxLength(450)]
    public string? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public EditorialStatus? EditorialStatus { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public ICollection<ContentModerationAction> ModerationActions { get; set; } = new List<ContentModerationAction>();
}
