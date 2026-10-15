import ContributionActions from '@/components/common/ContributionActions';
import TagFilter, { parseTagId } from '@/components/common/TagFilter';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchUpdates, type UpdatesPage } from '@/lib/updates-api';

export default function Aktualno() {
    const { ui, locale } = useUiTranslation();
    const [params, setParams] = useSearchParams();
    const tagId = parseTagId(params.get('tagId'));
    const requestedKind = params.get('kind');
    const kind = requestedKind === 'News' || requestedKind === 'Announcement' ? requestedKind : '';
    const requestedPage = Number(params.get('page') ?? 1);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
    const [result, setResult] = useLocalizedContentState<UpdatesPage | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setResult(null); setError(null);
        fetchUpdates(kind, page, controller.signal, tagId).then(value => {
            if (!controller.signal.aborted) setResult(value);
        }).catch(reason => {
            if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Objave se ne mogu učitati.');
        });
        return () => controller.abort();
    }, [kind, page, tagId, setResult]);
    const changeFilter = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        next.delete('page'); setParams(next);
    };
    const goToPage = (nextPage: number) => {
        const next = new URLSearchParams(params);
        next.set('page', String(nextPage)); setParams(next);
    };
    return <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
        <header><h1 className="text-4xl font-bold">{ui("Obavijesti")}</h1><p className="mt-3 text-slate-600">{ui("Sve obavijesti iz naših područja. Informacije s rokom prikazuju se dok su aktualne.")}</p></header>
            <ContributionActions kind="obavijest" tagId={tagId ? String(tagId) : undefined} />
        <TagFilter value={tagId} onChange={value => changeFilter('tagId', value)} />
        <details open={kind ? true : undefined} className="rounded border border-slate-200 p-3">
        <summary className="cursor-pointer font-medium">{ui('Dodatni filtri')}</summary>
        <nav aria-label={ui("Vrsta objave")} className="mt-3 flex flex-wrap gap-3">
            {([['', ui("Sve")], ['News', ui("Novosti")], ['Announcement', ui("Najave i važne obavijesti")]] as const).map(([value, label]) =>
                <button type="button" key={value} aria-pressed={kind === value} onClick={() => changeFilter('kind', value)}
                    className={`rounded border px-4 py-2 ${kind === value ? 'bg-blue-600 text-white' : ''}`}>{label}</button>)}
        </nav>
        </details>
        {!result && !error && <p role="status">{ui("Učitavanje objava...")}</p>}
        {error && <p role="alert" className="text-red-600">{ui(error)}</p>}
        {result?.items.length === 0 && <p>{ui("Nema objavljenih sadržaja.")}</p>}
        {result?.items.map(item => <article key={`${item.contentType}-${item.id}`} className="space-y-3 rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm text-slate-500">{ui("Obavijest")}{item.priority > 0 ? item.priority === 2 ? ui(" · Hitno") : ui(" · Važno") : ''} · {new Date(item.publishedAt).toLocaleDateString(locale)}</p>
            <h2 className="text-2xl font-semibold"><Link to={`/${item.contentType === 'News' ? 'novosti' : 'obavijesti'}/${item.slug}`}>{item.title}</Link></h2>
            <p>{item.summary}</p>
            {item.areaSlug && <Link to={`/nase-malo-misto/${item.areaSlug}`} className="text-sm text-blue-700">{item.areaName}</Link>}
        </article>)}
        {result && <nav aria-label={ui("Stranice objava")} className="flex gap-4">
            <button type="button" disabled={page === 1} onClick={() => goToPage(page - 1)} className="disabled:opacity-40">{ui("Prethodna")}</button>
            <span>{ui("Stranica")} {page}</span>
            <button type="button" disabled={!result.hasMore} onClick={() => goToPage(page + 1)} className="disabled:opacity-40">{ui("Sljedeća")}</button>
        </nav>}
    </div>;
}
