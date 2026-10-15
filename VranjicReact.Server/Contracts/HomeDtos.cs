namespace VranjicReact.Server.Contracts
{
    public record HomeResponse(
        IReadOnlyList<NewsSummaryDto> LatestNews,
        IReadOnlyList<GalleryAlbumSummaryDto> GalleryHighlights,
        IReadOnlyList<AreaDto> Areas,
        IReadOnlyList<AnnouncementSummaryDto> ImportantAnnouncements,
        IReadOnlyList<BlogPostSummaryDto> LatestBlogPosts);
}
