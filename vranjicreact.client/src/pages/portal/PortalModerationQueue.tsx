import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEditorialList } from '@/hooks/useEditorialList';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ModerationHistory } from '@/components/common/EditorialPanel';
import {
    decideModeration,
    fetchModerationQueuePage,
    type ModerationDecision,
    type ModerationQueueItem,
} from '@/lib/moderation-api';

export default function PortalModerationQueue() {
    const { ui } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const { items, page, setPage, hasMore, loading, error, setError, refresh, refreshAfterDelete } = useEditorialList(fetchModerationQueuePage);
    const [comments, setComments] = useState<Record<string, string>>({});

    const [processingKey, setProcessingKey] = useState<string | null>(null);


    const decide = async (item: ModerationQueueItem, decision: ModerationDecision) => {
        const key = `${item.contentType}-${item.id}`;
        const comment = comments[key]?.trim() || null;
        if (decision !== 'Approve' && !comment) {
            setError('Za traženje izmjena ili odbijanje upišite komentar.');
            return;
        }

        setProcessingKey(key);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            await decideModeration(item, decision, comment, token);
            setComments(current => { const next = { ...current }; delete next[key]; return next; });
            refreshAfterDelete();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Odluka nije spremljena.');
        } finally {
            setProcessingKey(null);
        }
    };

    if (loading) return <p className="text-sm text-slate-500">{ui("Učitavanje...")}</p>;

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold text-slate-800">{ui("Moderatorski red")}</h2>
                <p className="mt-1 text-sm text-slate-500">{ui("Prikazan je samo sadržaj iz područja koja su vam dodijeljena.")}</p>
                <p className="mt-1 text-sm text-slate-500">{ui('Ovdje dolazi sadržaj poslan na pregled. Spremljeni nacrti ostaju kod autora; nakon odobrenja objavu radi administrator.')}</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{ui(error)} <button type="button" onClick={refresh} className="underline">{ui("Pokušaj ponovno")}</button></p>}
            {!error && items.length === 0 ? (
                <p className="text-sm text-slate-600">{ui("Nema sadržaja koji čeka pregled.")}</p>
            ) : (
                <div className="space-y-3">
                    {items.map(item => {
                        const key = `${item.contentType}-${item.id}`;
                        const paths = { News: `/portal/news/${item.id}/edit`, Blog: `/portal/blog/${item.id}/edit`, Announcement: `/portal/announcements/${item.id}/edit`, Gallery: `/portal/gallery/${item.id}` };
                        const labels = { News: 'Obavijest', Blog: 'Priča', Announcement: 'Obavijest s rokom', Gallery: 'Album' };
                        const editPath = paths[item.contentType];
                        return (
                            <article key={key} className="rounded border border-slate-200 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{ui(labels[item.contentType])}</p>
                                        <h3 className="font-semibold text-slate-800">{item.title}</h3>
                                        <p className="text-sm text-slate-500">{item.area?.name ?? ui("Bez područja")}</p>
                                    </div>
                                    <div className="flex gap-3 text-sm">
                                        <Link to={editPath} className="font-semibold text-blue-700 hover:underline">{ui("Pregledaj")}</Link>
                                    </div>
                                </div>
                                <textarea
                                    aria-label={ui('Komentar odluke: {title}', { title: item.title })}
                                    value={comments[key] ?? ''}
                                    onChange={event => setComments(current => ({ ...current, [key]: event.target.value }))}
                                    placeholder={ui("Komentar odluke (obavezan za izmjene i odbijanje)")}
                                    maxLength={1000}
                                    className="mt-3 min-h-20 w-full rounded border border-slate-300 p-2 text-sm"
                                />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button disabled={processingKey !== null} onClick={() => void decide(item, 'Approve')} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{ui("Odobri")}</button>
                                    <button disabled={processingKey !== null} onClick={() => void decide(item, 'RequestChanges')} className="rounded border border-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-700 disabled:opacity-50">{ui("Traži izmjene")}</button>
                                    <button disabled={processingKey !== null} onClick={() => void decide(item, 'Reject')} className="rounded border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50">{ui("Odbij")}</button>
                                </div>
                                <ModerationHistory type={item.contentType} id={item.id} />
                            </article>
                        );
                    })}
                </div>
            )}
            {!error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} disabled={processingKey !== null} />}
        </div>
    );
}
