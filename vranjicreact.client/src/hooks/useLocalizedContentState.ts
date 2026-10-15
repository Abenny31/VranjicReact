import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeContent } from '@/lib/content-translations';

export function useLocalizedContentState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
    const [content, setContent] = useState(initial);
    const { language } = useLanguage();
    const localized = useMemo(() => localizeContent(content, language), [content, language]);
    return [localized, setContent];
}
