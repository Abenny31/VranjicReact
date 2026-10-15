import { apiFetch } from './api-client';
import type { EditorialStatus } from './types';
export interface MyContentItem {
    id: number; contentType: 'News' | 'Blog' | 'Announcement' | 'Gallery'; title: string;
    editorialStatus: EditorialStatus | null; rowVersion: string; lastChangedAt: string; canEdit: boolean; canSubmit: boolean;
}
export interface MyContentPage { items: MyContentItem[]; page: number; hasMore: boolean }
export function fetchMyContent(page: number, authorization: string, signal?: AbortSignal) {
    return apiFetch<MyContentPage>(`/api/my-content?page=${page}`, { headers: { Authorization: authorization }, signal });
}
