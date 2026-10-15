import type { TranslatedContent } from './content-translations';
export type ContentTimePerspective = 'Jucer' | 'Danas' | 'Sutra';
export type AnnouncementImportance = 'Normal' | 'Important' | 'Urgent';
export type ContentOrigin =
    | 'DocumentedAndVerified'
    | 'PersonalTestimony'
    | 'OralTradition'
    | 'AuthorCommentary';
export type ContentSourceType = 'Book' | 'Document' | 'Archive' | 'Url';
export type EditorialStatus =
    | 'Draft'
    | 'PendingReview'
    | 'ChangesRequested'
    | 'Rejected'
    | 'Approved'
    | 'Published'
    | 'Archived';

export interface AreaReference extends TranslatedContent {
    id: number;
    name: string;
    slug: string;
}

export interface Area extends AreaReference {
    shortDescription?: string | null;
    description?: string | null;
    coverImageUrl?: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt?: string | null;
}

export interface Tag extends TranslatedContent {
    id: number;
    name: string;
    slug: string;
    isActive: boolean;
}

export interface NewsSummary extends TranslatedContent {
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    publishedAt: string | null;
    isFeatured: boolean;
    heroImageUrl?: string | null;
    galleryAlbumId?: number | null;
    galleryImageId?: number | null;
    area?: AreaReference | null;
    timePerspective?: ContentTimePerspective | null;
    editorialStatus?: EditorialStatus | null;
    rowVersion: string;
    canEdit: boolean;
    canSubmit: boolean;
    latestModerationComment?: string | null;
    latestModerationAction?: string | null;
}

export interface NewsDetail extends NewsSummary {
    body: string;
    createdAt: string;
    updatedAt?: string | null;
    source?: string | null;
    tags: Tag[];
}

export interface AnnouncementSummary extends TranslatedContent {
    editorialStatus?: EditorialStatus | null;
    rowVersion: string;
    canEdit: boolean;
    canSubmit: boolean;
    id: number;
    slug: string;
    title: string;
    summary: string;
    startsAt: string;
    expiresAt?: string | null;
    publishedAt?: string | null;
    importance: AnnouncementImportance;
    actionLabel?: string | null;
    actionUrl?: string | null;
    isActive: boolean;
    isExpired: boolean;
    area?: AreaReference | null;
}

export interface AnnouncementDetail extends AnnouncementSummary {
    body: string;
    createdAt: string;
    updatedAt?: string | null;
    tags: Tag[];
}

export interface BlogPostSummary extends TranslatedContent {
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    heroImageUrl?: string | null;
    publishedAt?: string | null;
    isFeatured: boolean;
    origin?: ContentOrigin | null;
    verifiedAt?: string | null;
    area?: AreaReference | null;
    timePerspective?: ContentTimePerspective | null;
    editorialStatus?: EditorialStatus | null;
    rowVersion: string;
    canEdit: boolean;
    canSubmit: boolean;
    latestModerationComment?: string | null;
    latestModerationAction?: string | null;
}

export interface BlogPostSource {
    id: number;
    title: string;
    author?: string | null;
    year?: number | null;
    type: ContentSourceType;
    url?: string | null;
    note?: string | null;
}

export interface BlogPostDetail extends BlogPostSummary {
    body: string;
    createdAt: string;
    updatedAt?: string | null;
    tags: Tag[];
    sources: BlogPostSource[];
}

export interface GalleryItem extends TranslatedContent {
    id: number;
    albumId: number;
    title: string;
    description?: string | null;
    mediaType: 'Image' | 'Video';
    contentType?: string | null;
    fileName?: string | null;
    size: number;
    isFeatured: boolean;
    uploadedAt: string;
    canEdit: boolean;
    canDelete: boolean;
}

export interface GalleryAlbumSummary extends TranslatedContent {
    canViewHistory: boolean;
    eventDate?: string | null;
    photographer?: string | null;
    publishedAt?: string | null;
    editorialStatus?: EditorialStatus | null;
    rowVersion: string;
    canEdit: boolean;
    canSubmit: boolean;
    id: number;
    title: string;
    description?: string | null;
    imageCount: number;
    coverImage?: GalleryItem | null;
    relatedNewsId?: number | null;
    relatedNewsTitle?: string | null;
    relatedNewsSlug?: string | null;
    createdAt?: string | null;
    area?: AreaReference | null;
    timePerspective?: ContentTimePerspective | null;
    tags: Tag[];
}

export interface GalleryAlbumDetail {
    album: GalleryAlbumSummary;
    images: GalleryItem[];
}

export interface HomeResponse {
    latestNews: NewsSummary[];
    galleryHighlights: GalleryAlbumSummary[];
    areas: Area[];
    importantAnnouncements: AnnouncementSummary[];
    latestBlogPosts: BlogPostSummary[];
}

export interface SubmitContactRequest {
    name: string;
    email: string;
    message: string;
}

export interface UserProfile {
    nickname?: string | null;
    id: string;
    email: string;
    emailConfirmed: boolean;
    roles: string[];
}

export interface UserListItem {
    nickname?: string | null;
    isProtected?: boolean;
    invitationPending?: boolean;
    id: string;
    email: string;
    emailConfirmed: boolean;
    roles: string[];
}

export interface ContactMessage {
    id: number;
    name: string;
    email: string;
    message: string;
    submittedAt: string;
    processedAt?: string | null;
    archived: boolean;
}
