import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '@/content/translations';

export type SupportedLanguage = 'hr' | 'en';

interface LanguageContextValue {
    language: SupportedLanguage;
    setLanguage: (language: SupportedLanguage) => void;
    t: (key: string, defaultValue: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'vranjicreact.language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<SupportedLanguage>(() => {
        if (typeof window === 'undefined') {
            return 'hr';
        }

        const stored = window.localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
        return stored === 'en' ? 'en' : 'hr';
    });

    const setLanguage = useCallback((next: SupportedLanguage) => {
        setLanguageState(next);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, next);
        }
    }, []);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const value = useMemo<LanguageContextValue>(() => {
        const translate = (key: string, defaultValue: string) => {
            const dictionaries = translations[language] ?? {};
            return dictionaries[key] ?? dictionaries[defaultValue] ?? defaultValue;
        };

        return {
            language,
            setLanguage,
            t: translate,
        };
    }, [language, setLanguage]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
