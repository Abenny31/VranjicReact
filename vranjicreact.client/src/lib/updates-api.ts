import { apiFetch } from './api-client';
import type { EditorialStatus } from './types';
export type UpdateKind = 'News' | 'Announcement';
export interface UpdateSummary {
    id: number; contentType: UpdateKind; slug: string; title: string; summary: string;
    publishedAt: string; priority: number; areaName?: string | null; areaSlug?: string | null;
}
export interface UpdatesPage { items: UpdateSummary[]; page: number; hasMore: boolean }
export function fetchUpdates(kind: UpdateKind | '', page: number, signal?: AbortSignal, tagId?: number) {
    const query = new URLSearchParams({ page: String(page) });
    if (kind) query.set('kind', kind);
    if (tagId) query.set('tagId', String(tagId));
    return apiFetch<UpdatesPage>(`/api/updates?${query}`, { signal });
}

export interface EditorialUpdate {
    id: number;
    contentType: UpdateKind;
    title: string;
    slug: string;
    editorialStatus: EditorialStatus | null;
    rowVersion: string;
    lastChangedAt: string;
    publishedAt?: string | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    isActive: boolean;
    isExpired: boolean;
    canEdit: boolean;
    canSubmit: boolean;
    canViewHistory: boolean;
}
export interface EditorialUpdatesPage { items: EditorialUpdate[]; page: number; hasMore: boolean }
export function fetchEditorialUpdates(options: {
    authorization: string; kind?: UpdateKind; status?: EditorialStatus; search?: string;
    page: number; tagId?: number; signal?: AbortSignal;
}) {
    const query = new URLSearchParams({ page: String(options.page), pageSize: '20' });
    if (options.kind) query.set('kind', options.kind);
    if (options.status) query.set('status', options.status);
    if (options.search) query.set('search', options.search);
    if (options.tagId) query.set('tagId', String(options.tagId));
    return apiFetch<EditorialUpdatesPage>(`/api/updates/editorial?${query}`, {
        headers: { Authorization: options.authorization }, signal: options.signal,
    });
}
