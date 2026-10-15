const rawBase = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'https://localhost:7216' : '')).trim();
export const API_BASE_URL = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    return (await apiRequest<T>(path, options)).payload;
}

export interface ListPage<T> { items: T[]; hasMore: boolean }

export async function apiFetchPage<T>(path: string, options: RequestInit = {}): Promise<ListPage<T>> {
    const { payload, headers } = await apiRequest<T[]>(path, options);
    const hasMore = headers.get('X-Has-More');
    if (!Array.isArray(payload) || (hasMore !== 'true' && hasMore !== 'false')) {
        throw new Error('API ne podržava straničenje. Provjerite jesu li frontend i backend ažurirani zajedno.');
    }
    return { items: payload, hasMore: hasMore === 'true' };
}

async function apiRequest<T>(path: string, options: RequestInit): Promise<{ payload: T; headers: Headers }> {
    const url = `${API_BASE_URL}${path}`;
    const headers = new Headers(options.headers);
    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
        // Authentication uses an explicit Bearer header, not cookies (also for separate static hosting).
        credentials: options.credentials ?? 'omit',
        ...options,
        headers,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');

    let payload: unknown = undefined;
    if (response.status !== 204) {
        if (isJson) {
            payload = await response.json();
        } else {
            const text = await response.text();
            payload = text.length ? text : undefined;
        }
    }

    if (!response.ok) {
        const message = typeof payload === 'string'
            ? payload
            : typeof payload === 'object' && payload !== null && 'message' in payload
                ? String((payload as Record<string, unknown>).message)
                : `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    return { payload: payload as T, headers: response.headers };
}
