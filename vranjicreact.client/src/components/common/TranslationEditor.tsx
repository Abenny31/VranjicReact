import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateText } from '@/lib/translation-api';
import type { ContentTranslation, TranslationEdit } from '@/lib/content-translations';

export interface TranslationEditorProps {
    source: Record<string, string | null | undefined>;
    saved?: ContentTranslation[];
    edits: TranslationEdit[];
    onChange: (edits: TranslationEdit[]) => void;
    disabled?: boolean;
    onBusyChange: (busy: boolean) => void;
}

const fieldLabels: Record<string, [string, string]> = {
    title: ['Naslov', 'Title'], excerpt: ['Kratki opis', 'Excerpt'], body: ['Sadržaj', 'Body'],
    summary: ['Sažetak', 'Summary'], actionLabel: ['Tekst poveznice', 'Link label'],
    name: ['Naziv', 'Name'], description: ['Opis', 'Description'], shortDescription: ['Kratki opis', 'Short description'],
};

export default function TranslationEditor({ source, saved = [], edits, onChange, disabled, onBusyChange }: TranslationEditorProps) {
    const { getAccessToken } = useAuth();
    const { language: uiLanguage } = useLanguage();
    const en = uiLanguage === 'en';
    const [language, setLanguage] = useState('en');
    const [newLanguage, setNewLanguage] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const request = useRef<AbortController | null>(null);
    const sourceJson = JSON.stringify(Object.fromEntries(Object.entries(source).map(([key, text]) => [key, text ?? ''])));
    const latestSource = useRef(sourceJson);
    useEffect(() => { latestSource.current = sourceJson; }, [sourceJson]);
    useEffect(() => () => {
        request.current?.abort();
        onBusyChange(false);
    }, [onBusyChange]);

    const original = saved.find(item => item.language === language);
    const edit = edits.find(item => item.language === language);
    const fields = edit?.delete ? {} : edit?.fields ?? original?.fields ?? {};
    const stale = edit?.source ? JSON.stringify(edit.source) !== sourceJson : original?.isStale;
    const languages = [...new Set(['en', language, ...saved.map(item => item.language), ...edits.map(item => item.language)])];

    function change(next: TranslationEdit) {
        onChange([...edits.filter(item => item.language !== language), next]);
    }

    async function translate() {
        if (busy || disabled) return;
        const snapshot = JSON.parse(sourceJson) as Record<string, string>;
        const nonEmpty = Object.entries(snapshot).filter(([, text]) => text.trim());
        if (!nonEmpty.length) return;
        if (nonEmpty.some(([, text]) => text.length > 10000)) {
            setError(en ? 'Each source field can contain at most 10,000 characters for automatic translation.' : 'Za automatski prijevod svako HR polje može imati najviše 10.000 znakova.');
            return;
        }
        if (Object.values(fields).some(text => text?.trim()) && !window.confirm(en
            ? 'Replace this translation? Your manual changes will be replaced after a successful translation.'
            : 'Zamijeniti ovaj prijevod? Ručne izmjene zamijenit će se tek nakon uspješnog prijevoda.')) return;
        const controller = new AbortController();
        request.current = controller;
        setBusy(true); onBusyChange(true); setError(null); setNotice(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error(en ? 'Please sign in again.' : 'Prijavite se ponovno.');
            const translated: Record<string, string> = Object.fromEntries(Object.keys(snapshot).map(key => [key, '']));
            for (const [field, text] of nonEmpty) {
                if (controller.signal.aborted) return;
                translated[field] = (await translateText(text, language, token, controller.signal)).text;
            }
            if (controller.signal.aborted) return;
            if (latestSource.current !== sourceJson) throw new Error(en
                ? 'The Croatian text changed during translation. Please try again.'
                : 'Hrvatski tekst promijenjen je tijekom prijevoda. Pokrenite prijevod ponovno.');
            change({ language, fields: translated, source: snapshot, version: original?.version });
            setNotice(en ? 'Review the translation, then save the form.' : 'Pregledajte prijevod, zatim spremite obrazac.');
        } catch (reason) {
            if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Prijevod nije uspio.');
        } finally {
            if (!controller.signal.aborted) { setBusy(false); onBusyChange(false); }
        }
    }

    return <fieldset disabled={disabled || busy} className="space-y-3 rounded border border-slate-300 bg-slate-50 p-4">
        <legend className="px-1 font-semibold">{en ? 'Content translations' : 'Prijevodi sadržaja'}</legend>
        <p className="text-sm text-slate-600">{en ? 'Croatian is the source. Translations are saved with this form. Deleting a translation keeps the Croatian content.' : 'Hrvatski je izvornik. Prijevodi se spremaju zajedno s obrascem. Brisanje prijevoda zadržava HR sadržaj.'}</p>
        <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">{en ? 'Language' : 'Jezik'}
                <select aria-label={en ? 'Translation language' : 'Jezik prijevoda'} value={language} onChange={event => { setLanguage(event.target.value); setError(null); setNotice(null); }} className="ml-2 rounded border p-2">
                    {languages.map(code => <option key={code} value={code}>{code.toUpperCase()}</option>)}
                </select>
            </label>
            <label className="text-sm">{en ? 'New language code' : 'Oznaka novog jezika'}
                <input value={newLanguage} maxLength={16} placeholder="de" onChange={event => setNewLanguage(event.target.value.toLowerCase())} className="ml-2 w-24 rounded border p-2" />
            </label>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => {
                if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(newLanguage) || newLanguage === 'hr') {
                    setError(en ? 'Enter a language code other than hr.' : 'Unesite oznaku jezika različitu od hr.'); return;
                }
                setLanguage(newLanguage); setNewLanguage(''); setError(null);
            }}>{en ? 'Add language' : 'Dodaj jezik'}</button>
            <button type="button" onClick={() => void translate()} disabled={busy || !Object.values(source).some(text => text?.trim())} className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? (en ? 'Translating…' : 'Prevođenje…') : language === 'en' ? (en ? 'Translate to English' : 'Prevedi na engleski') : `${en ? 'Translate to' : 'Prevedi na'} ${language.toUpperCase()}`}
            </button>
        </div>
        {stale && !edit?.delete && <p role="status" className="text-sm text-amber-800">{en ? 'The source has changed. Review or regenerate this translation before using it.' : 'Izvornik je promijenjen. Pregledajte i uskladite prijevod ili ga ponovno generirajte.'}</p>}
        {edit?.delete ? <p role="status">{en ? 'This translation will be deleted when you save.' : 'Ovaj prijevod bit će obrisan nakon spremanja.'}</p> :
            <div className="grid gap-3 md:grid-cols-2">{Object.keys(source).map(field => <label key={field} className={`flex flex-col text-sm ${field === 'body' || field === 'description' ? 'md:col-span-2' : ''}`}>
                <span>{fieldLabels[field]?.[en ? 1 : 0] ?? field} ({language.toUpperCase()})</span>
                <textarea rows={field === 'body' ? 8 : 2} value={fields[field] ?? ''} onChange={event => change({
                    language, version: original?.version, fields: { ...fields, [field]: event.target.value },
                    source: edit?.source ?? JSON.parse(sourceJson) as Record<string, string>,
                })} className="mt-1 w-full rounded border border-slate-300 p-2" />
            </label>)}</div>}
        <div className="flex flex-wrap gap-2">
            {original && !edit?.delete && <button type="button" className="rounded border border-red-300 px-3 py-2 text-sm text-red-700" onClick={() => {
                if (window.confirm(en ? 'Delete only this translation when saving?' : 'Obrisati samo ovaj prijevod pri spremanju?')) change({ language, version: original.version, delete: true });
            }}>{en ? 'Delete translation' : 'Obriši prijevod'}</button>}
            {(original || edit) && !edit?.delete && <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => change({ language, version: original?.version, fields, source: JSON.parse(sourceJson) as Record<string, string> })}>{en ? 'Confirm reviewed against HR' : 'Potvrdi usklađeno s HR'}</button>}
            {edit && <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => onChange(edits.filter(item => item.language !== language))}>{en ? 'Discard translation changes' : 'Poništi izmjene prijevoda'}</button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    </fieldset>;
}
