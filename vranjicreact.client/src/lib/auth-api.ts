import { API_BASE_URL, apiFetch } from './api-client';
import type { UserProfile } from './types';

export interface TokenResponse {
    tokenType: string;
    accessToken: string;
    expiresIn: number;
    refreshToken?: string | null;
}

interface LoginRequest {
    email: string;
    password: string;
}

interface RefreshRequest {
    refreshToken: string;
}

interface LogoutRequest {
    refreshToken?: string | null;
}

const LOGIN_PATH = '/login?useCookies=false&useSessionCookies=false';
const REFRESH_PATH = '/refresh';
const LOGOUT_PATH = '/logout';

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

export async function login(request: LoginRequest): Promise<TokenResponse> {
    return postJson<TokenResponse>(buildUrl(LOGIN_PATH), request);
}

export async function refreshToken(request: RefreshRequest): Promise<TokenResponse> {
    return postJson<TokenResponse>(buildUrl(REFRESH_PATH), request);
}

export async function logout(request: LogoutRequest, accessToken?: string | null): Promise<void> {
    await postJson<void>(buildUrl(LOGOUT_PATH), request, accessToken ?? undefined);
}

export function fetchCurrentUser(accessToken: string) {
    return apiFetch<UserProfile>('/api/Account/me', {
        headers: {
            Authorization: formatAuthorization(accessToken),
        },
    });
}

function formatAuthorization(token: string): string {
    return token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
}

async function postJson<T>(url: string, payload: unknown, accessToken?: string): Promise<T> {
    const headers = new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
    });

    if (accessToken) {
        headers.set('Authorization', formatAuthorization(accessToken));
    }

    const response = await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        headers,
        body: JSON.stringify(payload ?? {}),
    });

    if (response.status === 204) {
        return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
        const message = typeof data === 'string'
            ? data
            : data && typeof data === 'object' && 'detail' in data
                ? String((data as Record<string, unknown>).detail)
                : typeof data === 'object' && data && 'title' in data
                    ? String((data as Record<string, unknown>).title)
                    : `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    return data as T;
}
