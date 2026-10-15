import type { TranslationEdit } from './content-translations';
import { apiFetch, apiFetchPage } from './api-client';
import type { AnnouncementDetail, AnnouncementImportance, AnnouncementSummary } from './types';

export interface UpsertAnnouncementPayload {
    translations?: TranslationEdit[];
    rowVersion?: string;
    title: string;
    summary: string;
    body: string;
    startsAt: string;
    expiresAt?: string | null;
    publishedAt?: string | null;
    importance: AnnouncementImportance;
    actionLabel?: string | null;
    actionUrl?: string | null;
    slug?: string | null;
    areaId?: number | null;
    tagIds?: number[];
}

interface FetchAnnouncementsOptions {
    page?: number;
    signal?: AbortSignal;
    limit?: number;
    includeExpired?: boolean;
    includeUnpublished?: boolean;
    area?: string;
    tagId?: number;
    authorization?: string;
}

interface FetchAnnouncementDetailOptions {
    includeUnpublished?: boolean;
    authorization?: string;
}

function fetchAnnouncementsPath(options: FetchAnnouncementsOptions) {
    const searchParams = new URLSearchParams();
    if (options.page) searchParams.set('page', String(options.page));
    if (typeof options.limit === 'number') {
        searchParams.set('limit', String(options.limit));
    }
    if (options.includeExpired) {
        searchParams.set('includeExpired', 'true');
    }
    if (options.includeUnpublished) {
        searchParams.set('includeUnpublished', 'true');
    }
    if (options.area) {
        searchParams.set('area', options.area);
    }
    if (typeof options.tagId === 'number') {
        searchParams.set('tagId', String(options.tagId));
    }

    const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    return `/api/announcements${query}`;
}

export function fetchAnnouncements(options: FetchAnnouncementsOptions = {}) {
    return apiFetch<AnnouncementSummary[]>(fetchAnnouncementsPath(options), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchAnnouncementsPage(options: FetchAnnouncementsOptions & { page: number }) {
    return apiFetchPage<AnnouncementSummary>(fetchAnnouncementsPath({ ...options, limit: options.limit ?? 20 }), {
        headers: options.authorization ? { Authorization: options.authorization } : undefined, signal: options.signal,
    });
}

export function fetchAnnouncementDetail(
    slugOrId: string,
    options: FetchAnnouncementDetailOptions = {}
) {
    const query = options.includeUnpublished ? '?includeUnpublished=true' : '';
    return apiFetch<AnnouncementDetail>(`/api/announcements/${slugOrId}${query}`, {
        headers: options.authorization
            ? { Authorization: options.authorization }
            : undefined,
    });
}

export function createAnnouncement(payload: UpsertAnnouncementPayload, authorization: string) {
    return apiFetch<AnnouncementDetail>('/api/announcements', {
        method: 'POST',
        headers: { Authorization: authorization },
        body: JSON.stringify(payload),
    });
}

export function updateAnnouncement(
    id: number,
    payload: UpsertAnnouncementPayload,
    authorization: string
) {
    return apiFetch<AnnouncementDetail>(`/api/announcements/${id}`, {
        method: 'PUT',
        headers: { Authorization: authorization },
        body: JSON.stringify(payload),
    });
}

export function deleteAnnouncement(id: number, authorization: string) {
    return apiFetch<void>(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authorization },
    });
}
