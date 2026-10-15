using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Models;

public class Area : ITranslatedEntity
{
    public ICollection<ContentTranslation> Translations { get; set; } = new List<ContentTranslation>();

    public int Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(512)]
    public string? ShortDescription { get; set; }

    public string? Description { get; set; }

    [MaxLength(512)]
    public string? CoverImageUrl { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<News> News { get; set; } = new List<News>();

    public ICollection<GalleryAlbum> GalleryAlbums { get; set; } = new List<GalleryAlbum>();

    public ICollection<Announcement> Announcements { get; set; } = new List<Announcement>();

    public ICollection<BlogPost> BlogPosts { get; set; } = new List<BlogPost>();
}
