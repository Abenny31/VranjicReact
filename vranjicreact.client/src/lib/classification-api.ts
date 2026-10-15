import type { TranslationEdit } from './content-translations';
import { apiFetch } from './api-client';
import type { Area, Tag } from './types';

export interface UpsertAreaPayload {
    translations?: TranslationEdit[];
    name: string;
    slug?: string | null;
    shortDescription?: string | null;
    description?: string | null;
    coverImageUrl?: string | null;
    sortOrder: number;
    isActive: boolean;
}

export interface UpsertTagPayload {
    translations?: TranslationEdit[];
    name: string;
    slug?: string | null;
    isActive: boolean;
}

function authorizationHeaders(authorization: string) {
    return { Authorization: authorization };
}

export const AREAS_CHANGED_EVENT = 'dfb:areas-changed';

export function fetchAreas(signal?: AbortSignal) {
    return apiFetch<Area[]>('/api/areas', { signal });
}

export function fetchArea(slug: string) {
    return apiFetch<Area>(`/api/areas/${encodeURIComponent(slug)}`);
}

export function fetchAdminAreas(authorization: string) {
    return apiFetch<Area[]>('/api/areas/admin', {
        headers: authorizationHeaders(authorization),
    });
}

export async function createArea(payload: UpsertAreaPayload, authorization: string) {
    const area = await apiFetch<Area>('/api/areas', {
        method: 'POST',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify(payload),
    });
    window.dispatchEvent(new Event(AREAS_CHANGED_EVENT));
    return area;
}

export async function updateArea(id: number, payload: UpsertAreaPayload, authorization: string) {
    const area = await apiFetch<Area>(`/api/areas/${id}`, {
        method: 'PUT',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify(payload),
    });
    window.dispatchEvent(new Event(AREAS_CHANGED_EVENT));
    return area;
}

export async function deleteArea(id: number, authorization: string) {
    await apiFetch<void>(`/api/areas/${id}`, {
        method: 'DELETE',
        headers: authorizationHeaders(authorization),
    });
    window.dispatchEvent(new Event(AREAS_CHANGED_EVENT));
}

export function fetchTags(signal?: AbortSignal) {
    return apiFetch<Tag[]>('/api/tags', { signal });
}

export function fetchAdminTags(authorization: string) {
    return apiFetch<Tag[]>('/api/tags/admin', {
        headers: authorizationHeaders(authorization),
    });
}

export function createTag(payload: UpsertTagPayload, authorization: string) {
    return apiFetch<Tag>('/api/tags', {
        method: 'POST',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify(payload),
    });
}

export function updateTag(id: number, payload: UpsertTagPayload, authorization: string) {
    return apiFetch<Tag>(`/api/tags/${id}`, {
        method: 'PUT',
        headers: authorizationHeaders(authorization),
        body: JSON.stringify(payload),
    });
}

export function deleteTag(id: number, authorization: string) {
    return apiFetch<void>(`/api/tags/${id}`, {
        method: 'DELETE',
        headers: authorizationHeaders(authorization),
    });
}
