import type { InlineImageUpload } from './inline-image-upload';
import type { TranslationEdit } from './content-translations';
import { apiFetch, apiFetchPage } from './api-client';
import type { ContentTimePerspective, GalleryAlbumDetail, GalleryAlbumSummary, GalleryItem } from './types';

export interface CreateGalleryItemPayload {
    translations?: TranslationEdit[];
    title: string;
    description?: string | null;
    mediaType: 'Image' | 'Video';
    contentType?: string | null;
    fileName?: string | null;
    base64Data: string;
    isFeatured: boolean;
    albumId: number;
}

export interface CreateGalleryAlbumPayload {
    imageUpload?: InlineImageUpload;
    translations?: TranslationEdit[];
    eventDate?: string | null;
    photographer?: string | null;
    rowVersion?: string;
    title: string;
    description?: string | null;
    relatedNewsId?: number | null;
    areaId?: number | null;
    timePerspective?: ContentTimePerspective | null;
    tagIds?: number[];
}

export interface UpdateGalleryItemPayload {
    translations?: TranslationEdit[];
    title: string;
    description?: string | null;
    isFeatured: boolean;
}

export function fetchGalleryItems() {
    return apiFetch<GalleryItem[]>('/api/gallery');
}

export function fetchGalleryItemsPage(options: { page: number; search?: string; albumId?: number; imagesOnly?: boolean; signal?: AbortSignal; authorization?: string }) {
    const query = new URLSearchParams({ page: String(options.page), limit: '20' });
    if (options.search?.trim()) query.set('search', options.search.trim());
    if (options.albumId) query.set('albumId', String(options.albumId));
    if (options.imagesOnly) query.set('imagesOnly', 'true');
    return apiFetchPage<GalleryItem>(`/api/gallery?${query}`, {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchGalleryItem(id: number, authorization?: string) {
    return apiFetch<GalleryItem>(`/api/gallery/${id}`, { headers: authorization ? { Authorization: authorization } : undefined });
}

interface FetchGalleryAlbumsOptions {
    search?: string;
    editableOnly?: boolean;
    page?: number;
    signal?: AbortSignal;
    limit?: number;
    authorization?: string;
    includeUnpublished?: boolean;
    area?: string;
    perspective?: ContentTimePerspective;
    tagId?: number;
    year?: number;
}

function fetchGalleryAlbumsPath(options: FetchGalleryAlbumsOptions) {
    const searchParams = new URLSearchParams();
    if (options.search?.trim()) searchParams.set('search', options.search.trim());
    if (options.editableOnly) searchParams.set('editableOnly', 'true');
    if (options.page) searchParams.set('page', String(options.page));
    if (options.limit) searchParams.set('limit', String(options.limit));
    if (options.includeUnpublished) searchParams.set('includeUnpublished', 'true');
    if (options.area) {
        searchParams.set('area', options.area);
    }
    if (options.perspective) {
        searchParams.set('perspective', options.perspective);
    }
    if (typeof options.tagId === 'number') {
        searchParams.set('tagId', options.tagId.toString());
    }
    if (typeof options.year === 'number') {
        searchParams.set('year', options.year.toString());
    }

    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    return `/api/gallery/albums${query}`;
}

export function fetchGalleryAlbums(options: FetchGalleryAlbumsOptions = {}) {
    return apiFetch<GalleryAlbumSummary[]>(fetchGalleryAlbumsPath(options), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchGalleryAlbumsPage(options: FetchGalleryAlbumsOptions & { page: number }) {
    return apiFetchPage<GalleryAlbumSummary>(fetchGalleryAlbumsPath({ ...options, limit: options.limit ?? 20 }), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchGalleryAlbum(albumId: number, authorization?: string) {
    return apiFetch<GalleryAlbumDetail>(`/api/gallery/albums/${albumId}`, {
        headers: authorization
            ? {
                Authorization: authorization,
            }
            : undefined,
    });
}

export function createGalleryItem(payload: CreateGalleryItemPayload, authorization: string) {
    return apiFetch<GalleryItem>('/api/gallery', {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export function updateGalleryItem(id: number, payload: UpdateGalleryItemPayload, authorization: string) {
    return apiFetch<GalleryItem>(`/api/gallery/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export function deleteGalleryItem(id: number, authorization: string) {
    return apiFetch<void>(`/api/gallery/${id}`, {
        method: 'DELETE',
        headers: {
            Authorization: authorization,
        },
    });
}

export function createGalleryAlbum(payload: CreateGalleryAlbumPayload, authorization: string) {
    return apiFetch<GalleryAlbumSummary>('/api/gallery/albums', {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export function updateGalleryAlbum(id: number, payload: CreateGalleryAlbumPayload, authorization: string) {
    return apiFetch<void>(`/api/gallery/albums/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}
