import { apiFetch, apiFetchPage } from './api-client';
import type { AreaReference, EditorialStatus } from './types';

export type ModeratedContentType = 'News' | 'Blog' | 'Announcement' | 'Gallery';

export interface ModerationHistoryEntry {
    id: number;
    action: string;
    previousStatus?: EditorialStatus | null;
    newStatus: EditorialStatus;
    actorUserId?: string | null;
    comment?: string | null;
    createdAt: string;
}

export function fetchModerationHistory(type: ModeratedContentType, id: number, authorization: string, beforeId?: number) {
    return apiFetch<{ items: ModerationHistoryEntry[]; nextBeforeId: number | null }>(
        `/api/moderation/${type.toLowerCase()}/${id}/history${beforeId ? `?beforeId=${beforeId}` : ''}`,
        { headers: authorizationHeaders(authorization) },
    );
}
export type ModerationDecision = 'Approve' | 'RequestChanges' | 'Reject';

export interface ModerationQueueItem {
    contentType: ModeratedContentType;
    id: number;
    title: string;
    slug: string;
    area?: AreaReference | null;
    status: EditorialStatus;
    createdAt: string;
    updatedAt?: string | null;
    rowVersion: string;
}

export interface AreaModeratorAssignment {
    id: number;
    userId: string;
    userEmail: string;
    area: AreaReference;
    isActive: boolean;
    assignedAt: string;
    endsAt?: string | null;
    status?: 'Active' | 'Expired' | 'Inactive';
}

function authorizationHeaders(authorization: string) {
    return { Authorization: authorization };
}

export function fetchModerationQueuePage(options: { authorization: string; page: number; signal?: AbortSignal }) {
    return apiFetchPage<ModerationQueueItem>(`/api/moderation/queue?page=${options.page}&limit=20`, {
        headers: authorizationHeaders(options.authorization), signal: options.signal,
    });
}

export function fetchModerationQueue(authorization: string) {
    return apiFetch<ModerationQueueItem[]>('/api/moderation/queue', {
        headers: authorizationHeaders(authorization),
    });
}

export function submitForReview(
    contentType: ModeratedContentType,
    id: number,
    rowVersion: string,
    authorization: string,
) {
    return apiFetch<void>(`/api/moderation/${contentType.toLowerCase()}/${id}/submit`, {
        method: 'POST',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify({ rowVersion }),
    });
}

export function decideModeration(
    item: ModerationQueueItem,
    decision: ModerationDecision,
    comment: string | null,
    authorization: string,
) {
    return apiFetch<void>(`/api/moderation/${item.contentType.toLowerCase()}/${item.id}/decision`, {
        method: 'POST',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify({ decision, comment, rowVersion: item.rowVersion }),
    });
}

export function publishApproved(
    contentType: ModeratedContentType,
    id: number,
    rowVersion: string,
    authorization: string,
) {
    return apiFetch<void>(`/api/moderation/${contentType.toLowerCase()}/${id}/publish`, {
        method: 'POST',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify({ rowVersion, publishedAt: null }),
    });
}

export function archiveContent(
    contentType: ModeratedContentType,
    id: number,
    rowVersion: string,
    authorization: string,
) {
    return apiFetch<void>(`/api/moderation/${contentType.toLowerCase()}/${id}/archive`, {
        method: 'POST',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify({ rowVersion }),
    });
}

export function fetchModeratorAssignments(authorization: string) {
    return apiFetch<AreaModeratorAssignment[]>('/api/moderator-assignments', {
        headers: authorizationHeaders(authorization),
    });
}

export interface AssignmentListOptions {
    authorization: string; page: number; signal?: AbortSignal; search?: string; areaId?: number;
    status?: 'all' | 'active' | 'expired' | 'inactive';
}

export function fetchModeratorAssignmentsPage(options: AssignmentListOptions) {
    const query = new URLSearchParams({ page: String(options.page), limit: '20' });
    if (options.search?.trim()) query.set('search', options.search.trim());
    if (options.areaId) query.set('areaId', String(options.areaId));
    if (options.status) query.set('status', options.status);
    return apiFetchPage<AreaModeratorAssignment>(`/api/moderator-assignments?${query}`, {
        headers: authorizationHeaders(options.authorization), signal: options.signal,
    });
}

export function saveModeratorAssignment(
    payload: { userId: string; areaId: number; endsAt?: string | null },
    authorization: string,
) {
    return apiFetch<AreaModeratorAssignment>('/api/moderator-assignments', {
        method: 'POST',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify(payload),
    });
}

export function deactivateModeratorAssignment(id: number, authorization: string) {
    return apiFetch<void>(`/api/moderator-assignments/${id}`, {
        method: 'DELETE',
        headers: authorizationHeaders(authorization),
    });
}
