import { lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TranslationEditorProps } from './TranslationEditor';

const TranslationEditor = lazy(() => import('./TranslationEditor'));

export default function LazyTranslationEditor(props: TranslationEditorProps) {
    const { language } = useLanguage();
    return <Suspense fallback={<p role="status" className="text-sm text-slate-500">
        {language === 'en' ? 'Loading translation editor…' : 'Učitavanje editora prijevoda…'}
    </p>}><TranslationEditor {...props} /></Suspense>;
}
