import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/** Source-text keys share the existing language catalogue with named translation keys. */
export function useUiTranslation() {
    const { t, language } = useLanguage();
    const ui = useCallback((text: string, values?: Record<string, string | number>) => {
        const translated = t(text, text);
        return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
            values?.[key] === undefined ? placeholder : String(values[key]));
    }, [t]);
    return { ui, locale: language === 'en' ? 'en-GB' : 'hr-HR' };
}
