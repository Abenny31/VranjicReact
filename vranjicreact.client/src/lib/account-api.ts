import { apiFetch, apiFetchPage } from './api-client';
import type { UserListItem } from './types';

export interface CreateUserPayload {
    nickname?: string;
    email: string;
    password: string;
    confirmEmail: boolean;
    roles?: string[];
}

export interface UpdateUserPayload {
    nickname?: string;
    email: string;
    emailConfirmed: boolean;
    roles?: string[];
}

export interface ChangePasswordPayload {
    currentPassword: string;
    newPassword: string;
}

export function fetchUsers(authorization: string) {
    return apiFetch<UserListItem[]>('/api/account/users', {
        headers: {
            Authorization: authorization,
        },
    });
}

export interface UserListOptions {
    authorization: string;
    page: number;
    search?: string;
    role?: string;
    emailConfirmed?: boolean;
    signal?: AbortSignal;
}

export function fetchUsersPage({ authorization, page, search, role, emailConfirmed, signal }: UserListOptions) {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (search?.trim()) query.set('search', search.trim());
    if (role) query.set('role', role);
    if (emailConfirmed !== undefined) query.set('emailConfirmed', String(emailConfirmed));
    return apiFetchPage<UserListItem>(`/api/account/users?${query}`, { headers: { Authorization: authorization }, signal });
}

export function fetchUser(id: string, authorization: string) {
    return apiFetch<UserListItem>(`/api/account/users/${id}`, {
        headers: {
            Authorization: authorization,
        },
    });
}

export function createUser(payload: CreateUserPayload, authorization: string) {
    return apiFetch<UserListItem>('/api/account/users', {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export function updateUser(id: string, payload: UpdateUserPayload, authorization: string) {
    return apiFetch<UserListItem>(`/api/account/users/${id}`, {
        method: 'PUT',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export function deleteUser(id: string, authorization: string) {
    return apiFetch<void>(`/api/account/users/${id}`, {
        method: 'DELETE',
        headers: {
            Authorization: authorization,
        },
    });
}

export function approveUser(id: string, authorization: string) {
    return apiFetch<UserListItem>(`/api/account/users/${id}/approve`, {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
    });
}

export function changePassword(payload: ChangePasswordPayload, authorization: string) {
    return apiFetch<void>('/api/account/me/password', {
        method: 'POST',
        headers: {
            Authorization: authorization,
        },
        body: JSON.stringify(payload),
    });
}

export interface InvitationResult { userId: string; emailSent: boolean; message: string }

export function fetchInvitationAvailability(authorization: string) {
    return apiFetch<{ enabled: boolean }>('/api/account/invitations/availability', { headers: { Authorization: authorization } });
}

export function inviteUser(payload: { email: string; roles: string[]; nickname?: string }, authorization: string) {
    return apiFetch<InvitationResult>('/api/account/invitations', {
        method: 'POST', headers: { Authorization: authorization }, body: JSON.stringify(payload),
    });
}

export function resendInvitation(id: string, authorization: string) {
    return apiFetch<InvitationResult>(`/api/account/invitations/${encodeURIComponent(id)}/resend`, {
        method: 'POST', headers: { Authorization: authorization },
    });
}

export function acceptInvitation(payload: { userId: string; token: string; password: string }) {
    return apiFetch<void>('/api/account/invitations/accept', { method: 'POST', body: JSON.stringify(payload) });
}
