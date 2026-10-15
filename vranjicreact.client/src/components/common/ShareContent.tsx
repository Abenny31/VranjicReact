import { useId, useRef, useState } from 'react';
import { useUiTranslation } from '@/hooks/useUiTranslation';

interface Props { title: string; path: string; text?: string }

export default function ShareContent({ title, path, text }: Props) {
    const { ui } = useUiTranslation();
    const [busy, setBusy] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [message, setMessage] = useState('');
    const optionsId = useId();
    const shareButton = useRef<HTMLButtonElement>(null);
    // Use a public path supplied by the detail page, never a URL with private query/hash tokens.
    const url = new URL(path, window.location.origin).href;
    const shareText = [title, text, url].filter(Boolean).join('\n\n');
    const share = async () => {
        if (busy) return;
        setMessage('');
        if (!navigator.share) { setExpanded(value => !value); return; }
        setBusy(true);
        try {
            const data = { title, text, url };
            if (navigator.canShare && !navigator.canShare(data)) {
                setExpanded(true);
                return;
            }
            await navigator.share(data);
            setExpanded(false);
        }
        catch (reason) {
            const cancelled = typeof reason === 'object' && reason !== null && 'name' in reason && reason.name === 'AbortError';
            if (!cancelled) {
                setExpanded(true);
                setMessage('Dijeljenje nije dostupno. Odaberite drugi način dijeljenja.');
            }
        } finally { setBusy(false); }
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setMessage('Poveznica je kopirana.');
        } catch {
            setMessage('Automatsko kopiranje nije dostupno. Označite i kopirajte poveznicu iz polja.');
        }
    };

    return <div className="my-4 space-y-2 text-sm normal-case tracking-normal" onKeyDown={event => {
        if (event.key === 'Escape' && expanded) {
            setExpanded(false);
            shareButton.current?.focus();
        }
    }}>
        <button ref={shareButton} type="button" disabled={busy} aria-expanded={expanded} aria-controls={expanded ? optionsId : undefined} onClick={() => void share()} className="rounded border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50">{ui('Podijeli')}</button>
        {expanded && <div id={optionsId} className="space-y-2 rounded border border-slate-200 p-3">
            <div className="flex flex-wrap gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2">WhatsApp</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2">Facebook</a>
                <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareText)}`} className="rounded border px-3 py-2">Email</a>
                <button type="button" onClick={() => void copy()} className="rounded border px-3 py-2">{ui('Kopiraj poveznicu')}</button>
            </div>
            <label className="block">{ui('Poveznica za dijeljenje')}
                <input readOnly value={url} onFocus={event => event.currentTarget.select()} className="mt-1 w-full rounded border p-2 text-slate-800" />
            </label>
        </div>}
        {message && <p role="status">{ui(message)}</p>}
    </div>;
}
