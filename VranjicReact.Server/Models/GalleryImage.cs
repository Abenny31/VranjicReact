using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VranjicReact.Server.Models
{
    public class GalleryImage : ITranslatedEntity
    {
        public ICollection<ContentTranslation> Translations { get; set; } = new List<ContentTranslation>();

        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(512)]
        public string? Description { get; set; }

        [Required]
        public GalleryMediaType MediaType { get; set; } = GalleryMediaType.Image;

        public int AlbumId { get; set; }

        public GalleryAlbum? Album { get; set; }

        [MaxLength(128)]
        public string? ContentType { get; set; }

        [MaxLength(260)]
        public string? FileName { get; set; }

        public byte[] Data { get; set; } = Array.Empty<byte>();

        public long Size { get; set; }

        public bool IsFeatured { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(256)]
        public string? UploadedByUserId { get; set; }
    }

    public enum GalleryMediaType
    {
        Image = 0,
        Video = 1
    }
}
