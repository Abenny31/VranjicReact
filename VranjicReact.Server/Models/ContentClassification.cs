namespace VranjicReact.Server.Models;

public enum ContentTimePerspective
{
    Jucer = 1,
    Danas = 2,
    Sutra = 3,
}

public class NewsTag
{
    public int NewsId { get; set; }

    public required News News { get; set; }

    public int TagId { get; set; }

    public required Tag Tag { get; set; }
}

public class GalleryAlbumTag
{
    public int GalleryAlbumId { get; set; }

    public required GalleryAlbum GalleryAlbum { get; set; }

    public int TagId { get; set; }

    public required Tag Tag { get; set; }
}

public class AnnouncementTag
{
    public int AnnouncementId { get; set; }

    public required Announcement Announcement { get; set; }

    public int TagId { get; set; }

    public required Tag Tag { get; set; }
}

public class BlogPostTag
{
    public int BlogPostId { get; set; }

    public required BlogPost BlogPost { get; set; }

    public int TagId { get; set; }

    public required Tag Tag { get; set; }
}
