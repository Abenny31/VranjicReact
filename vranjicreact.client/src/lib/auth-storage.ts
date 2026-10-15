export interface AuthSession {
    tokenType: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: number;
}

const STORAGE_KEY = 'vr_auth_session_v1';
const CLOCK_SKEW_MS = 30_000; // guard window before expiration

export function storeAuthSession(session: AuthSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function readAuthSession(): AuthSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<AuthSession>;
        if (!parsed || typeof parsed.accessToken !== 'string' || typeof parsed.tokenType !== 'string' || typeof parsed.expiresAt !== 'number') {
            return null;
        }

        return {
            tokenType: parsed.tokenType,
            accessToken: parsed.accessToken,
            refreshToken: parsed.refreshToken ?? null,
            expiresAt: parsed.expiresAt,
        };
    } catch (err) {
        console.warn('Failed to parse stored auth session', err);
        return null;
    }
}

export function clearAuthSession(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export function isAccessTokenExpired(session: AuthSession, skewMs: number = CLOCK_SKEW_MS): boolean {
    return Date.now() + Math.max(skewMs, 0) >= session.expiresAt;
}
