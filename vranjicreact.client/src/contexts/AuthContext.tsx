import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCurrentUser, login as loginApi, logout as logoutApi, refreshToken as refreshTokenApi, TokenResponse } from '@/lib/auth-api';
import { AuthSession, clearAuthSession, isAccessTokenExpired, readAuthSession, storeAuthSession } from '@/lib/auth-storage';
import type { UserProfile } from '@/lib/types';

interface AuthContextValue {
    status: 'loading' | 'authenticated' | 'unauthenticated';
    user: UserProfile | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    getAccessToken: () => Promise<string | null>;
    hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_EXPIRY_BUFFER_SECONDS = 30;

function normaliseTokenResponse(response: TokenResponse): AuthSession {
    const safeExpiresIn = typeof response.expiresIn === 'number' ? response.expiresIn : 0;
    const expiresAt = Date.now() + Math.max(safeExpiresIn - TOKEN_EXPIRY_BUFFER_SECONDS, 1) * 1000;

    return {
        tokenType: response.tokenType ?? 'Bearer',
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? null,
        expiresAt,
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
    const [user, setUser] = useState<UserProfile | null>(null);
    const sessionRef = useRef<AuthSession | null>(null);

    const setSession = useCallback((value: AuthSession | null) => {
        sessionRef.current = value;
        if (value) {
            storeAuthSession(value);
        } else {
            clearAuthSession();
        }
    }, []);

    const resetState = useCallback(() => {
        setSession(null);
        setUser(null);
        setStatus('unauthenticated');
    }, [setSession]);

    const ensureProfile = useCallback(async (activeSession: AuthSession) => {
        try {
            const profile = await fetchCurrentUser(activeSession.accessToken);
            setUser(profile);
            setStatus('authenticated');
        } catch (error) {
            console.error('Failed to load user profile', error);
            resetState();
            throw error;
        }
    }, [resetState]);

    const applyTokenResponse = useCallback(async (response: TokenResponse) => {
        const nextSession = normaliseTokenResponse(response);
        setSession(nextSession);
        await ensureProfile(nextSession);
        return nextSession;
    }, [ensureProfile, setSession]);

    useEffect(() => {
        const bootstrap = async () => {
            const stored = readAuthSession();

            if (!stored) {
                resetState();
                return;
            }

            let current = stored;

            if (isAccessTokenExpired(current)) {
                if (!current.refreshToken) {
                    resetState();
                    return;
                }

                try {
                    current = normaliseTokenResponse(await refreshTokenApi({ refreshToken: current.refreshToken }));
                    setSession(current);
                } catch (error) {
                    console.warn('Stored session refresh failed', error);
                    resetState();
                    return;
                }
            } else {
                setSession(current);
            }

            try {
                await ensureProfile(current);
            } catch {
                // ensureProfile already handles reset
            }
        };

        void bootstrap();
    }, [ensureProfile, resetState, setSession]);

    const getLatestSession = useCallback(() => sessionRef.current, []);

    const refreshAccessToken = useCallback(async () => {
        const current = getLatestSession();
        if (!current || !current.refreshToken) {
            resetState();
            return null;
        }

        try {
            const refreshed = normaliseTokenResponse(await refreshTokenApi({ refreshToken: current.refreshToken }));
            setSession(refreshed);
            return `${refreshed.tokenType} ${refreshed.accessToken}`;
        } catch (error) {
            console.warn('Token refresh failed', error);
            resetState();
            return null;
        }
    }, [getLatestSession, resetState, setSession]);

    const getAccessToken = useCallback(async () => {
        const current = getLatestSession();
        if (!current) {
            return null;
        }

        if (!isAccessTokenExpired(current)) {
            return `${current.tokenType} ${current.accessToken}`;
        }

        return refreshAccessToken();
    }, [getLatestSession, refreshAccessToken]);

    const login = useCallback(async (email: string, password: string) => {
        setStatus('loading');
        try {
            const tokenResponse = await loginApi({ email, password });
            await applyTokenResponse(tokenResponse);
        } catch (error) {
            resetState();
            throw error;
        }
    }, [applyTokenResponse, resetState]);

    const logout = useCallback(async () => {
        const current = getLatestSession();
        try {
            if (current) {
                await logoutApi({ refreshToken: current.refreshToken ?? undefined }, `${current.tokenType} ${current.accessToken}`);
            }
        } catch (error) {
            console.warn('Logout request failed', error);
        } finally {
            resetState();
        }
    }, [getLatestSession, resetState]);

    const hasRole = useCallback((role: string) => {
        if (!user) {
            return false;
        }
        return user.roles.some(r => r.toLowerCase() === role.toLowerCase());
    }, [user]);

    const value = useMemo<AuthContextValue>(() => ({
        status,
        user,
        login,
        logout,
        getAccessToken,
        hasRole,
    }), [getAccessToken, hasRole, login, logout, status, user]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

