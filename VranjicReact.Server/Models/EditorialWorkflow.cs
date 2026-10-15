using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Models;

public enum EditorialStatus
{
    Draft = 1,
    PendingReview = 2,
    ChangesRequested = 3,
    Rejected = 4,
    Approved = 5,
    Published = 6,
    Archived = 7,
}

public enum ModerationActionType
{
    Submitted = 1,
    Approved = 2,
    ChangesRequested = 3,
    Rejected = 4,
    Published = 5,
    Archived = 6,
    ApprovalReset = 7,
}

public class AreaModeratorAssignment
{
    public int Id { get; set; }

    [Required]
    [MaxLength(450)]
    public string UserId { get; set; } = string.Empty;

    public int AreaId { get; set; }

    public Area Area { get; set; } = null!;

    public bool IsActive { get; set; } = true;

    [MaxLength(450)]
    public string? AssignedByUserId { get; set; }

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public DateTime? EndsAt { get; set; }
}

public class ContentModerationAction
{
    public int Id { get; set; }

    public int? NewsId { get; set; }

    public News? News { get; set; }

    public int? BlogPostId { get; set; }

    public BlogPost? BlogPost { get; set; }

    public int? AnnouncementId { get; set; }

    public Announcement? Announcement { get; set; }

    public int? GalleryAlbumId { get; set; }

    public GalleryAlbum? GalleryAlbum { get; set; }

    public ModerationActionType Action { get; set; }

    public EditorialStatus? PreviousStatus { get; set; }

    public EditorialStatus NewStatus { get; set; }

    [MaxLength(450)]
    public string? ActorUserId { get; set; }

    [MaxLength(1000)]
    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
