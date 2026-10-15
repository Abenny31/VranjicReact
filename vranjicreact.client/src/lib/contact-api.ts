import { apiFetch, apiFetchPage } from './api-client';
import type { SubmitContactRequest, ContactMessage } from './types';

export function submitContact(payload: SubmitContactRequest) {
    return apiFetch<void>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function fetchContactMessages(authorization: string, archived?: boolean) {
    const query = archived === undefined ? '' : `?archived=${archived}`;
    return apiFetch<ContactMessage[]>(`/api/contact/messages${query}`, {
        headers: {
            Authorization: authorization,
        },
    });
}

export interface ContactListOptions {
    authorization: string;
    page: number;
    search?: string;
    archived?: boolean;
    processed?: boolean;
    signal?: AbortSignal;
}

export function fetchContactMessagesPage({ authorization, page, search, archived, processed, signal }: ContactListOptions) {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (search?.trim()) query.set('search', search.trim());
    if (archived !== undefined) query.set('archived', String(archived));
    if (processed !== undefined) query.set('processed', String(processed));
    return apiFetchPage<ContactMessage>(`/api/contact/messages?${query}`, { headers: { Authorization: authorization }, signal });
}

export function markContactProcessed(id: number, authorization: string) {
    return apiFetch<void>(`/api/contact/${id}/process`, {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
    });
}

export function setContactArchive(id: number, archived: boolean, authorization: string) {
    return apiFetch<void>(`/api/contact/${id}/archive`, {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify({ archived }),
    });
}
