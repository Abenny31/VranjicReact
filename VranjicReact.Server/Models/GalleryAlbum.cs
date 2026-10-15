using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Models;

public class GalleryAlbum : IEditorialContent, ITranslatedEntity
{
    public ICollection<ContentTranslation> Translations { get; set; } = new List<ContentTranslation>();

    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(512)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public DateOnly? EventDate { get; set; }

    [MaxLength(200)]
    public string? Photographer { get; set; }

    [MaxLength(450)]
    public string? CreatedByUserId { get; set; }

    public DateTime? PublishedAt { get; set; }

    public EditorialStatus? EditorialStatus { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public ICollection<ContentModerationAction> ModerationActions { get; set; } = new List<ContentModerationAction>();

    public int? AreaId { get; set; }

    public Area? Area { get; set; }

    public ContentTimePerspective? TimePerspective { get; set; }

    public ICollection<GalleryImage> Images { get; set; } = new List<GalleryImage>();

    public ICollection<GalleryAlbumTag> GalleryAlbumTags { get; set; } = new List<GalleryAlbumTag>();
}
