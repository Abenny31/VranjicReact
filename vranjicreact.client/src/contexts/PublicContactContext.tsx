import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchPublicContact, type PublicContact } from '@/lib/public-contact-api';

interface PublicContactState {
    contact: PublicContact | null;
    loading: boolean;
    error: boolean;
    reload: () => void;
}

const PublicContactContext = createContext<PublicContactState | null>(null);

export function PublicContactProvider({ children }: { children: ReactNode }) {
    const [contact, setContact] = useState<PublicContact | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        fetchPublicContact(controller.signal).then(result => {
            if (!controller.signal.aborted) setContact(result);
        }).catch(() => {
            if (!controller.signal.aborted) setError(true);
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [attempt]);

    const reload = () => { setLoading(true); setError(false); setAttempt(value => value + 1); };
    return <PublicContactContext.Provider value={{ contact, loading, error, reload }}>{children}</PublicContactContext.Provider>;
}

export function usePublicContact() {
    const context = useContext(PublicContactContext);
    if (!context) throw new Error('usePublicContact requires PublicContactProvider.');
    return context;
}
