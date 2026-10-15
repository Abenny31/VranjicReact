export interface ContentTranslation {
    language: string;
    fields: Record<string, string | null>;
    isStale: boolean;
    version: string;
}

export interface TranslationEdit {
    language: string;
    fields?: Record<string, string | null>;
    source?: Record<string, string | null>;
    version?: string;
    delete?: boolean;
}

export interface TranslatedContent { translations?: ContentTranslation[] }

// Works on API content only. Original HR objects and editor state remain untouched.
export function localizeContent<T>(value: T, language: string): T {
    if (language === 'hr' || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => localizeContent(item, language)) as T;
    const source = value as Record<string, unknown>;
    const result = Object.fromEntries(Object.entries(source).map(([key, item]) =>
        [key, key === 'translations' ? item : localizeContent(item, language)]));
    const translations = (source as TranslatedContent).translations;
    const translation = translations?.find(item => item.language === language && !item.isStale);
    if (translation) {
        for (const [field, text] of Object.entries(translation.fields)) {
            if (Object.hasOwn(source, field) && typeof text === 'string' && text.trim()) result[field] = text;
        }
    }
    if (result.area && typeof result.area === 'object' && Object.hasOwn(result, 'areaName'))
        result.areaName = (result.area as { name: string }).name;
    if (result.relatedNews && typeof result.relatedNews === 'object' && Object.hasOwn(result, 'relatedNewsTitle'))
        result.relatedNewsTitle = (result.relatedNews as { title: string }).title;
    return result as T;
}
