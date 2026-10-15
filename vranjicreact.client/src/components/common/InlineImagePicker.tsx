import { useEffect, useId, useState } from 'react';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { IMAGE_ACCEPT, validateInlineImage } from '@/lib/inline-image-upload';
import ContentImage from './ContentImage';

export default function InlineImagePicker({ file, onChange, currentUrl, disabled }: {
    file: File | null; onChange: (file: File | null) => void; currentUrl?: string; disabled?: boolean;
}) {
    const { ui } = useUiTranslation();
    const id = useId();
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | undefined>();
    useEffect(() => {
        if (!file) { setPreview(undefined); return; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    const select = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        event.target.value = '';
        if (!selected) return;
        try { validateInlineImage(selected); onChange(selected); setError(null); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Fotografiju nije moguće učitati.'); }
    };
    return <fieldset disabled={disabled} className="space-y-3 rounded border border-slate-200 p-4">
        <legend className="px-1 font-semibold">{ui('Fotografija')}</legend>
        <label htmlFor={`${id}-file`} className="block text-sm font-semibold">{ui('Odaberi fotografiju s uređaja')}</label>
        <input id={`${id}-file`} type="file" accept={IMAGE_ACCEPT} onChange={select} className="block max-w-full text-sm" />
        <label htmlFor={`${id}-camera`} className="block text-sm font-semibold">{ui('Snimi fotografiju')}</label>
        <input id={`${id}-camera`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={select} className="block max-w-full text-sm" />
        <p className="text-xs text-slate-500">{ui('JPG, PNG, GIF ili WebP do 20 MiB. Fotografija se učitava tek kada spremite obrazac. Kamera ovisi o podršci uređaja.')}</p>
        {error && <p role="alert" className="text-sm text-red-700">{ui(error)}</p>}
        {file && <p className="break-all text-sm">{file.name} <button type="button" onClick={() => onChange(null)} className="ml-2 underline">{ui('Ukloni odabranu fotografiju')}</button></p>}
        {preview ? <img src={preview} alt={ui('Pregled odabrane fotografije')} className="max-h-64 w-full rounded object-contain" />
            : currentUrl && <ContentImage src={currentUrl} alt={ui('Naslovna fotografija')} />}
    </fieldset>;
}
