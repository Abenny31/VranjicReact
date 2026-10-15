import type { InlineImageUpload } from './inline-image-upload';
import type { TranslationEdit } from './content-translations';
import { apiFetch, apiFetchPage } from './api-client';
import type {
    BlogPostDetail,
    BlogPostSummary,
    ContentOrigin,
    ContentSourceType,
    ContentTimePerspective,
} from './types';

export interface UpsertBlogPostSourcePayload {
    translations?: TranslationEdit[];
    title: string;
    author?: string | null;
    year?: number | null;
    type: ContentSourceType;
    url?: string | null;
    note?: string | null;
}

export interface UpsertBlogPostPayload {
    imageUpload?: InlineImageUpload;
    translations?: TranslationEdit[];
    title: string;
    excerpt: string;
    body: string;
    heroImageUrl?: string | null;
    publishedAt?: string | null;
    isFeatured: boolean;
    origin?: ContentOrigin | null;
    slug?: string | null;
    areaId?: number | null;
    timePerspective?: ContentTimePerspective | null;
    tagIds?: number[];
    sources?: UpsertBlogPostSourcePayload[];
    rowVersion?: string | null;
}

interface FetchBlogPostsOptions {
    page?: number;
    signal?: AbortSignal;
    limit?: number;
    includeUnpublished?: boolean;
    area?: string;
    perspective?: ContentTimePerspective;
    tagId?: number;
    origin?: ContentOrigin;
    authorization?: string;
}

interface FetchBlogPostDetailOptions {
    signal?: AbortSignal;
    includeUnpublished?: boolean;
    authorization?: string;
}

function fetchBlogPostsPath(options: FetchBlogPostsOptions) {
    const searchParams = new URLSearchParams();
    if (options.page) searchParams.set('page', String(options.page));
    if (typeof options.limit === 'number') searchParams.set('limit', String(options.limit));
    if (options.includeUnpublished) searchParams.set('includeUnpublished', 'true');
    if (options.area) searchParams.set('area', options.area);
    if (options.perspective) searchParams.set('perspective', options.perspective);
    if (typeof options.tagId === 'number') searchParams.set('tagId', String(options.tagId));
    if (options.origin) searchParams.set('origin', options.origin);

    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    return `/api/blog${query}`;
}

export function fetchBlogPosts(options: FetchBlogPostsOptions = {}) {
    return apiFetch<BlogPostSummary[]>(fetchBlogPostsPath(options), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchBlogPostsPage(options: FetchBlogPostsOptions & { page: number }) {
    return apiFetchPage<BlogPostSummary>(fetchBlogPostsPath({ ...options, limit: options.limit ?? 20 }), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchBlogPostDetail(slugOrId: string, options: FetchBlogPostDetailOptions = {}) {
    const query = options.includeUnpublished ? '?includeUnpublished=true' : '';
    return apiFetch<BlogPostDetail>(`/api/blog/${slugOrId}${query}`, {
        signal: options.signal,
        headers: options.authorization ? { Authorization: options.authorization } : undefined,
    });
}

export function createBlogPost(payload: UpsertBlogPostPayload, authorization: string) {
    return apiFetch<BlogPostDetail>('/api/blog', {
        method: 'POST',
        headers: { Authorization: authorization },
        body: JSON.stringify(payload),
    });
}

export function updateBlogPost(id: number, payload: UpsertBlogPostPayload, authorization: string) {
    return apiFetch<BlogPostDetail>(`/api/blog/${id}`, {
        method: 'PUT',
        headers: { Authorization: authorization },
        body: JSON.stringify(payload),
    });
}

export function verifyBlogPost(id: number, authorization: string) {
    return apiFetch<BlogPostDetail>(`/api/blog/${id}/verify`, {
        method: 'POST',
        headers: { Authorization: authorization },
    });
}

export function deleteBlogPost(id: number, authorization: string) {
    return apiFetch<void>(`/api/blog/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authorization },
    });
}
