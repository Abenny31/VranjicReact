import ContributionActions from '@/components/common/ContributionActions';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchBlogPostsPage } from '@/lib/blog-api';
import { fetchAreas, fetchTags } from '@/lib/classification-api';
import { originLabels, perspectiveLabels } from '@/lib/content-labels';
import type { Area, BlogPostSummary, ContentOrigin, ContentTimePerspective, Tag } from '@/lib/types';

export default function Blog() {
    const { ui } = useUiTranslation();
    const [params, setParams] = useSearchParams();
    const [items, setItems] = useLocalizedContentState<BlogPostSummary[]>([]);
    const [areas, setAreas] = useLocalizedContentState<Area[]>([]);
    const [tags, setTags] = useLocalizedContentState<Tag[]>([]);
    const area = params.get('area') ?? '';
    const perspectiveParam = params.get('perspective') ?? '';
    const perspective = Object.hasOwn(perspectiveLabels, perspectiveParam) ? perspectiveParam as ContentTimePerspective : '';
    const originParam = params.get('origin') ?? '';
    const origin = Object.hasOwn(originLabels, originParam) ? originParam as ContentOrigin : '';
    const tagParam = Number(params.get('tagId'));
    const tagId = Number.isSafeInteger(tagParam) && tagParam > 0 ? String(tagParam) : '';
    const pageParam = Number(params.get('page') ?? 1);
    const page = Number.isInteger(pageParam) && pageParam > 0 && pageParam <= 10000 ? pageParam : 1;
    const changeFilter = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        next.delete('page');
        setParams(next);
    };
    const setPage = (value: number) => {
        const next = new URLSearchParams(params);
        next.set('page', String(value)); setParams(next);
    };
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterError, setFilterError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        Promise.all([fetchAreas(), fetchTags()])
            .then(([areaResult, tagResult]) => {
                if (active) {
                    setAreas(areaResult);
                    setTags(tagResult);
                }
            })
            .catch(() => {
                if (active) setFilterError('Područja i oznake trenutno nisu dostupni. Popis priča i dalje je dostupan.');
            });

        return () => {
            active = false;
        };
    }, [setItems, setAreas, setTags]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null);
        let active = true;
        fetchBlogPostsPage({ page, signal: controller.signal,
            area: area || undefined,
            perspective: perspective || undefined,
            origin: origin || undefined,
            tagId: tagId ? Number.parseInt(tagId, 10) : undefined,
        })
            .then(result => {
                if (active) { setItems(result.items); setHasMore(result.hasMore); }
            })
            .catch(reason => {
                if (active) setError(reason instanceof Error ? reason.message : 'Priče se ne mogu učitati.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            controller.abort();
            active = false;
        };
    }, [area, origin, perspective, tagId, page, setItems, setAreas, setTags]);

    return (
        <div className="mx-auto max-w-6xl px-4 py-12">
            <header className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">{ui("Priče iz Vranjica")}</p>
                <h1 className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">{ui("Priče")}</h1>
                <p className="mt-4 text-slate-600 dark:text-white/70">
                    {ui("Sve priče iz svih područja. Odaberite područje i istražite njegovu prošlost, današnji život ili buduće planove.")} </p>
            </header>
            <ContributionActions kind="prica" area={area} tagId={tagId} perspective={perspective} />

            <section aria-label={ui("Filtri priča")} className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
                <select aria-label={ui("Područje")} value={area} onChange={event => { changeFilter('area', event.target.value); }} className="rounded border border-slate-300 p-2 text-sm">
                    <option value="">{ui("Sva područja")}</option>
                    {areas.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}
                </select>
                <select aria-label={ui("Vremenska perspektiva")} value={perspective} onChange={event => { changeFilter('perspective', event.target.value); }} className="rounded border border-slate-300 p-2 text-sm">
                    <option value="">{ui("Sve perspektive")}</option>
                    {Object.entries(perspectiveLabels).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}
                </select>
                <select aria-label={ui("Podrijetlo sadržaja")} value={origin} onChange={event => { changeFilter('origin', event.target.value); }} className="rounded border border-slate-300 p-2 text-sm">
                    <option value="">{ui("Sva podrijetla")}</option>
                    {Object.entries(originLabels).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}
                </select>
                <select aria-label={ui("Oznaka")} value={tagId} onChange={event => { changeFilter('tagId', event.target.value); }} className="rounded border border-slate-300 p-2 text-sm">
                    <option value="">{ui("Sve oznake")}</option>
                    {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                </select>
            </section>
            {filterError && <p role="alert" className="mt-3 text-sm text-amber-700">{ui(filterError)}</p>}

            {loading && <p className="mt-10 text-center text-slate-500">{ui("Učitavanje priča...")}</p>}
            {error && <p className="mt-10 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{ui(error)}</p>}

            {!loading && !error && items.length === 0 && (
                <p className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    {ui("Za odabrane filtre nema objavljenih priča.")} </p>
            )}

            {!loading && !error && items.length > 0 && (
                <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => (
                        <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1">
                            {item.heroImageUrl && <img src={item.heroImageUrl} alt="" loading="lazy" className="h-48 w-full object-cover" />}
                            <div className="p-6">
                                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {item.area && <span>{item.area.name}</span>}
                                    {item.timePerspective && <span>{ui(perspectiveLabels[item.timePerspective])}</span>}
                                </div>
                                <h2 className="mt-3 text-xl font-semibold text-slate-900">
                                    <Link to={`/blog/${item.slug}`} className="hover:text-primary-700">{item.title}</Link>
                                </h2>
                                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.excerpt}</p>
                                {item.origin && <p className="mt-4 text-xs font-semibold text-primary-700">{ui(originLabels[item.origin])}</p>}
                                <Link to={`/blog/${item.slug}`} className="mt-5 inline-flex text-sm font-semibold text-primary-700">{ui("Pročitaj priču →")}</Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
            {!loading && !error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} />}
        </div>
    );
}
