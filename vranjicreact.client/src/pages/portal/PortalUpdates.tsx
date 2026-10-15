import TagFilter, { parseTagId } from '@/components/common/TagFilter';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEditorialUpdates, type EditorialUpdatesPage } from '@/lib/updates-api';
import { editorialStatusLabels } from '@/lib/content-labels';
import type { EditorialStatus } from '@/lib/types';
import EditorialPanel from '@/components/common/EditorialPanel';

export default function PortalUpdates() {
    const { ui, locale } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const [params, setParams] = useSearchParams();
    const tagId = parseTagId(params.get('tagId'));
    const kindParam = params.get('kind');
    const kind = kindParam === 'News' || kindParam === 'Announcement' ? kindParam : '';
    const statusParam = params.get('status');
    const status = statusParam && Object.hasOwn(editorialStatusLabels, statusParam) ? statusParam as EditorialStatus : '';
    const search = (params.get('search') ?? '').slice(0, 200);
    const requestedPage = Number(params.get('page') ?? 1);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
    const [searchInput, setSearchInput] = useState(search);
    const [result, setResult] = useState<EditorialUpdatesPage | null>(null);
    const [revision, setRevision] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { setSearchInput(search); }, [search]);
    useEffect(() => {
        const controller = new AbortController();
        setResult(null); setError(null);
        getAccessToken().then(async token => {
            if (controller.signal.aborted) return;
            if (!token) throw new Error('Sesija je istekla.');
            const response = await fetchEditorialUpdates({
                authorization: token, kind: kind || undefined, status: status || undefined,
                search: search || undefined, page, tagId, signal: controller.signal,
            });
            if (!controller.signal.aborted) setResult(response);
        }).catch(reason => {
            if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Objave nisu dostupne.');
        });
        return () => controller.abort();
    }, [getAccessToken, revision, kind, status, search, page, tagId]);

    const changeFilter = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        next.delete('page'); setParams(next);
    };
    const goToPage = (nextPage: number) => {
        const next = new URLSearchParams(params);
        next.set('page', String(nextPage)); setParams(next);
    };
    const submitSearch = (event: FormEvent) => {
        event.preventDefault(); changeFilter('search', searchInput.trim());
    };

    return <div className="space-y-4">
        <h2 className="text-xl font-semibold">{ui("Obavijesti — moje objave i pregled")}</h2>
        <div className="flex flex-wrap gap-3">
            <Link to="/portal/news/new" className="font-semibold text-blue-700">{ui("Nova obavijest")}</Link>
            <details className="text-sm"><summary className="cursor-pointer">{ui('Raspored i važnost')}</summary>
                <p className="my-2">{ui('Za najavu s početkom prikazivanja, važnosti ili neobaveznim istekom koristite napredni obrazac.')}</p>
                <Link to="/portal/announcements/new" className="font-semibold text-blue-700">{ui("Obavijest s rasporedom")}</Link>
            </details>
        </div>
        <div className="flex flex-wrap items-end gap-4">
            <TagFilter value={tagId} onChange={value => changeFilter('tagId', value)} />
            <details open={kind ? true : undefined}><summary className="cursor-pointer text-sm">{ui('Dodatni filtri')}</summary>
                <label className="mt-2 flex flex-col text-sm">{ui("Vrsta")}<select value={kind} onChange={e => changeFilter('kind', e.target.value)} className="rounded border p-2">
                    <option value="">{ui("Sve")}</option><option value="News">{ui("Novosti")}</option><option value="Announcement">{ui("Najave i važne obavijesti")}</option>
                </select></label>
            </details>
            <label className="flex flex-col text-sm">{ui("Status")}<select value={status} onChange={e => changeFilter('status', e.target.value)} className="rounded border p-2">
                <option value="">{ui("Svi statusi")}</option>{Object.entries(editorialStatusLabels).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}
            </select></label>
            <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col text-sm">{ui("Pretraga naslova")}<input value={searchInput} maxLength={200} onChange={e => setSearchInput(e.target.value)} className="rounded border p-2" /></label>
                <button type="submit" className="rounded border px-3 py-2 text-sm">{ui("Pretraži")}</button>
            </form>
        </div>
        {!result && !error && <p role="status">{ui("Učitavanje...")}</p>}
        {error && <div role="alert" className="text-red-600">{ui(error)} <button type="button" onClick={() => setRevision(v => v + 1)} className="underline">{ui("Pokušaj ponovno")}</button></div>}
        {result?.items.map(item => <article key={`${item.contentType}-${item.id}`} className="space-y-3 rounded border p-4">
            <h3 className="font-semibold">{item.title} <span className="text-xs">({item.contentType === 'News' ? ui("Obavijest") : ui("Obavijest s rokom")})</span></h3>
            <p className="text-xs text-slate-500">{ui("Zadnja izmjena:")} {new Date(item.lastChangedAt).toLocaleString(locale)}</p>
            <Link to={`/portal/${item.contentType === 'News' ? 'news' : 'announcements'}/${item.id}/edit`} className="text-blue-700">{item.canEdit ? ui("Uredi") : ui("Pregledaj")}</Link>
            {item.contentType === 'Announcement' && item.editorialStatus === 'Published' && <p className="text-sm">{item.isExpired ? ui("Istekla — dostupna u arhivi obavijesti.") : item.isActive ? ui("Vidljiva javno.") : ui("Zakazana — čeka datum objave ili početak prikaza.")}</p>}
            <EditorialPanel type={item.contentType} id={item.id} status={item.editorialStatus} rowVersion={item.rowVersion}
                canSubmit={item.canSubmit} canViewHistory={item.canViewHistory} onChanged={() => setRevision(v => v + 1)} />
        </article>)}
        {result?.items.length === 0 && <p>{ui("Nema objava za ovaj odabir.")}</p>}
        {result && <nav aria-label={ui("Stranice uredničkih objava")} className="flex gap-4">
            <button type="button" disabled={page === 1} onClick={() => goToPage(page - 1)} className="disabled:opacity-40">{ui("Prethodna")}</button>
            <span>{ui("Stranica")} {page}</span>
            <button type="button" disabled={!result.hasMore} onClick={() => goToPage(page + 1)} className="disabled:opacity-40">{ui("Sljedeća")}</button>
        </nav>}
        <p className="text-xs text-slate-500">{ui("Najnovije izmjene su prve. Obavijesti bez datuma objave ostaju nacrti.")}</p>
    </div>;
}
