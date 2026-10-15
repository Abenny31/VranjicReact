using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Models;

public class Tag : ITranslatedEntity
{
    public ICollection<ContentTranslation> Translations { get; set; } = new List<ContentTranslation>();

    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Slug { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<NewsTag> NewsTags { get; set; } = new List<NewsTag>();

    public ICollection<GalleryAlbumTag> GalleryAlbumTags { get; set; } = new List<GalleryAlbumTag>();

    public ICollection<AnnouncementTag> AnnouncementTags { get; set; } = new List<AnnouncementTag>();

    public ICollection<BlogPostTag> BlogPostTags { get; set; } = new List<BlogPostTag>();
}
