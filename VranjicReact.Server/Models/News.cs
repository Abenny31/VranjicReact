using System.ComponentModel.DataAnnotations;

namespace VranjicReact.Server.Models
{
    public class News : IEditorialContent, ITranslatedEntity
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

        public DateTime? PublishedAt { get; set; }

        public bool IsFeatured { get; set; }

        [MaxLength(512)]
        public string? HeroImageUrl { get; set; }

        public int? GalleryAlbumId { get; set; }

        public GalleryAlbum? GalleryAlbum { get; set; }

        public int? GalleryImageId { get; set; }

        public GalleryImage? GalleryImage { get; set; }

        public int? AreaId { get; set; }

        public Area? Area { get; set; }

        public ContentTimePerspective? TimePerspective { get; set; }

        public ICollection<NewsTag> NewsTags { get; set; } = new List<NewsTag>();

        [MaxLength(64)]
        public string? Source { get; set; }

        [MaxLength(450)]
        public string? CreatedByUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public EditorialStatus? EditorialStatus { get; set; }

        [Timestamp]
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();

        public ICollection<ContentModerationAction> ModerationActions { get; set; } = new List<ContentModerationAction>();
    }
}
