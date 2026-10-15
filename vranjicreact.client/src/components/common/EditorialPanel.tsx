import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { editorialStatusLabels } from '@/lib/content-labels';
import { archiveContent, fetchModerationHistory, publishApproved, submitForReview, type ModeratedContentType, type ModerationHistoryEntry } from '@/lib/moderation-api';
import type { EditorialStatus } from '@/lib/types';

interface Props {
    type: ModeratedContentType;
    id: number;
    status?: EditorialStatus | null;
    rowVersion: string;
    canSubmit: boolean;
    canViewHistory?: boolean;
    onChanged: () => void;
}

const actionLabels: Record<string, string> = {
    Submitted: 'Poslano na pregled', Approved: 'Odobreno', ChangesRequested: 'Zatražene izmjene',
    Rejected: 'Odbijeno', Published: 'Objavljeno', Archived: 'Arhivirano', ApprovalReset: 'Pregled poništen',
};

export function ModerationHistory({ type, id }: Pick<Props, 'type' | 'id'>) {
    const { ui, locale } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState<ModerationHistoryEntry[]>([]);
    const [next, setNext] = useState<number | null>(null);
    const [cursor, setCursor] = useState<number | undefined>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true);
        setError(null);
        getAccessToken().then(async token => {
            if (!token) throw new Error('Sesija je istekla.');
            return fetchModerationHistory(type, id, token, cursor);
        }).then(page => {
            if (!active) return;
            setEntries(previous => cursor ? [...previous, ...page.items] : page.items);
            setNext(page.nextBeforeId);
        }).catch(reason => {
            if (active) setError(reason instanceof Error ? reason.message : 'Povijest nije dostupna.');
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [open, type, id, cursor, getAccessToken]);
    return <div className="text-sm">
        <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); setCursor(undefined); }} className="text-blue-700 underline">{ui("Povijest moderiranja")}</button>
        {open && <div className="mt-2 space-y-2">
            {error && <p role="alert" className="text-red-600">{ui(error)}</p>}
            {!loading && !error && entries.length === 0 && <p>{ui("Nema zabilježenih odluka.")}</p>}
            <ol className="space-y-2">{entries.map(entry => <li key={entry.id} className="border-l-2 border-slate-300 pl-3">
                <p>{ui(actionLabels[entry.action] ?? entry.action)} · {new Date(entry.createdAt).toLocaleString(locale)}</p>
                <p className="text-xs text-slate-500">{entry.previousStatus ? ui(editorialStatusLabels[entry.previousStatus]) : ui("Početno stanje")} → {ui(editorialStatusLabels[entry.newStatus])}  {ui("· Korisnik:")} {entry.actorUserId ?? ui("Obrisan račun")}</p>
                {entry.comment && <p className="whitespace-pre-wrap">{entry.comment}</p>}
            </li>)}</ol>
            {loading && <p role="status">{ui("Učitavanje povijesti...")}</p>}
            {!loading && next && <button type="button" onClick={() => setCursor(next)} className="text-blue-700 underline">{ui("Starije odluke")}</button>}
        </div>}
    </div>;
}

export default function EditorialPanel({ type, id, status, rowVersion, canSubmit, canViewHistory = true, onChanged }: Props) {
    const { ui } = useUiTranslation();
    const { getAccessToken, hasRole } = useAuth();
    const manager = hasRole('SuperUser') || hasRole('Administrator');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = async (action: 'submit' | 'publish' | 'archive') => {
        if (action === 'archive' && !window.confirm(ui("Arhivirati sadržaj i ukloniti ga iz javnog pregleda?"))) return;
        if (action === 'publish' && status !== 'Approved' && !window.confirm(ui("Izravna administratorska objava bez pregleda bit će zabilježena u povijesti. Nastaviti?"))) return;
        setBusy(true); setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla.');
            const execute = action === 'submit' ? submitForReview : action === 'publish' ? publishApproved : archiveContent;
            await execute(type, id, rowVersion, token);
            onChanged();
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Radnja nije uspjela.'); }
        finally { setBusy(false); }
    };
    return <section aria-label={ui("Urednički tijek")} className="space-y-2 rounded border border-slate-200 p-3 text-sm">
        <p>{ui("Status:")} <strong>{status ? ui(editorialStatusLabels[status]) : ui("Nacrt")}</strong></p>
        {canSubmit && <p className="text-slate-600">{ui('Spremanje čuva nacrt. Moderator ga dobiva tek kada odaberete „Pošalji na pregled”.')}</p>}
        {status === 'PendingReview' && <p>{ui('Sadržaj je poslan na pregled moderatoru nadležnog područja.')}</p>}
        {status === 'Approved' && <p>{ui('Moderator je odobrio sadržaj. Sljedeći je korak objava administratora.')}</p>}
        {error && <p role="alert" className="text-red-600">{ui(error)}</p>}
        <div className="flex flex-wrap gap-3">
            {canSubmit && <button type="button" disabled={busy} onClick={() => void run('submit')} className="rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{ui("Pošalji na pregled")}</button>}
            {manager && status !== 'Published' && <button type="button" disabled={busy} onClick={() => void run('publish')} className="text-emerald-700 disabled:opacity-50">{status === 'Approved' ? ui("Objavi") : ui("Objavi izravno")}</button>}
            {manager && status !== 'Archived' && <button type="button" disabled={busy} onClick={() => void run('archive')} className="text-amber-700 disabled:opacity-50">{ui("Arhiviraj")}</button>}
        </div>
        {canViewHistory && <ModerationHistory key={`${type}-${id}-${rowVersion}`} type={type} id={id} />}
    </section>;
}
