import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api-client';

interface PublicDisplay { initialAreaCount: number; areaTagSlugs?: Record<string, string[]>; contentTagSlugs?: Record<string, string[]> }
// Safe display fallback while loading or when the settings API is unavailable.
const defaultDisplay: PublicDisplay = { initialAreaCount: 5, areaTagSlugs: {}, contentTagSlugs: {} };
const PublicDisplayContext = createContext({ ...defaultDisplay, unavailable: false, loading: false });

export function PublicDisplayProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState({ ...defaultDisplay, unavailable: false, loading: true });
    useEffect(() => {
        const controller = new AbortController();
        apiFetch<PublicDisplay>('/api/public-settings', { signal: controller.signal }).then(value => {
            if (!Number.isInteger(value.initialAreaCount) || value.initialAreaCount < 1 || value.initialAreaCount > 50) throw new Error('Invalid public display settings.');
            if (!controller.signal.aborted) setSettings({ initialAreaCount: value.initialAreaCount, areaTagSlugs: value.areaTagSlugs ?? {}, contentTagSlugs: value.contentTagSlugs ?? {}, unavailable: false, loading: false });
        }).catch(() => { if (!controller.signal.aborted) setSettings({ ...defaultDisplay, unavailable: true, loading: false }); });
        return () => controller.abort();
    }, []);
    return <PublicDisplayContext.Provider value={settings}>{children}</PublicDisplayContext.Provider>;
}

export const usePublicDisplay = () => useContext(PublicDisplayContext);
