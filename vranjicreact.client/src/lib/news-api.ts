import type { InlineImageUpload } from './inline-image-upload';
import type { TranslationEdit } from './content-translations';
import { apiFetch, apiFetchPage } from './api-client';
import type { ContentTimePerspective, NewsDetail, NewsSummary } from './types';

export interface UpsertNewsPayload {
    imageUpload?: InlineImageUpload;
    translations?: TranslationEdit[];
    title: string;
    excerpt: string;
    body: string;
    publishedAt?: string | null;
    isFeatured: boolean;
    heroImageUrl?: string | null;
    source?: string | null;
    slug?: string | null;
    galleryAlbumId?: number | null;
    galleryImageId?: number | null;
    areaId?: number | null;
    timePerspective?: ContentTimePerspective | null;
    tagIds?: number[];
    rowVersion?: string | null;
}

interface FetchNewsOptions {
    search?: string;
    unlinkedOnly?: boolean;
    page?: number;
    signal?: AbortSignal;
    limit?: number;
    authorization?: string;
    includeUnpublished?: boolean;
    area?: string;
    perspective?: ContentTimePerspective;
    tagId?: number;
}

interface FetchNewsDetailOptions {
    authorization?: string;
    includeUnpublished?: boolean;
}

function fetchNewsPath(options: FetchNewsOptions) {
    const searchParams = new URLSearchParams();
    if (options.search?.trim()) searchParams.set('search', options.search.trim());
    if (options.unlinkedOnly) searchParams.set('unlinkedOnly', 'true');
    if (options.page) searchParams.set('page', String(options.page));
    if (typeof options.limit === 'number') {
        searchParams.set('limit', options.limit.toString());
    }
    if (options.includeUnpublished) {
        searchParams.set('includeUnpublished', 'true');
    }
    if (options.area) {
        searchParams.set('area', options.area);
    }
    if (options.perspective) {
        searchParams.set('perspective', options.perspective);
    }
    if (typeof options.tagId === 'number') {
        searchParams.set('tagId', options.tagId.toString());
    }

    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    return `/api/news${query}`;
}

export function fetchNews(options: FetchNewsOptions = {}) {
    return apiFetch<NewsSummary[]>(fetchNewsPath(options), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchNewsPage(options: FetchNewsOptions & { page: number }) {
    return apiFetchPage<NewsSummary>(fetchNewsPath({ ...options, limit: options.limit ?? 20 }), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchNewsDetail(slugOrId: string, options: FetchNewsDetailOptions = {}) {
    const query = options.includeUnpublished ? '?includeUnpublished=true' : '';
    return apiFetch<NewsDetail>(`/api/news/${slugOrId}${query}`, {
        headers: options.authorization
            ? {
                Authorization: options.authorization,
            }
            : undefined,
    });
}

export function createNews(payload: UpsertNewsPayload, authorization: string) {
    return apiFetch<NewsDetail>('/api/news', {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export function updateNews(id: number, payload: UpsertNewsPayload, authorization: string) {
    return apiFetch<NewsDetail>(`/api/news/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export function deleteNews(id: number, authorization: string) {
    return apiFetch<void>(`/api/news/${id}`, {
        method: 'DELETE',
        headers: {
            Authorization: authorization,
        },
    });
}
