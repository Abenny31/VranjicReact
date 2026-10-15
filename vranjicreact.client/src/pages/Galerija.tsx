import ContributionActions from '@/components/common/ContributionActions';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_BASE_URL } from '@/lib/api-client';
import { fetchGalleryAlbumsPage } from '@/lib/gallery-api';
import { fetchAreas, fetchTags } from '@/lib/classification-api';
import type { Area, Tag, ContentTimePerspective, GalleryAlbumSummary } from '@/lib/types';

export default function Galerija() {
    const { ui, locale } = useUiTranslation();
    const { t } = useLanguage();
    const [albums, setAlbums] = useLocalizedContentState<GalleryAlbumSummary[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterError, setFilterError] = useState<string | null>(null);
    const [areas, setAreas] = useLocalizedContentState<Area[]>([]);
    const [tags, setTags] = useLocalizedContentState<Tag[]>([]);
    const [area, setArea] = useState('');
    const [year, setYear] = useState('');
    const [perspective, setPerspective] = useState<ContentTimePerspective | ''>('');
    const [tag, setTag] = useState('');
    useEffect(() => {
        let active = true;
        Promise.all([fetchAreas(), fetchTags()]).then(([a, t]) => {
            if (active) { setAreas(a); setTags(t); }
        }).catch(() => { if (active) setFilterError('Područja i oznake trenutno nisu dostupni. Popis albuma i dalje je dostupan.'); });
        return () => { active = false; };
    }, [setAlbums, setAreas, setTags]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null);
        let isMounted = true;
        fetchGalleryAlbumsPage({ page, signal: controller.signal, area: area || undefined, year: year ? Number(year) : undefined,
            perspective: perspective || undefined, tagId: tag ? Number(tag) : undefined })
            .then(response => {
                if (isMounted) {
                    setAlbums(response.items); setHasMore(response.hasMore);
                }
            })
            .catch(err => {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Neuspjelo učitavanje galerije.');
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });
        return () => {
            controller.abort();
            isMounted = false;
        };
    }, [area, year, perspective, tag, page, setAlbums, setAreas, setTags]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-12">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{t('gallery.page.title', 'Galerija')}</h1>
                <p className="mt-3 text-slate-600 dark:text-white/70">{t('gallery.page.description', 'Galerija albuma s naših aktivnosti.')}</p>
            </header>
            <ContributionActions kind="galerija" />
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col text-sm">{ui("Područje")}<select value={area} onChange={e => { setArea(e.target.value); setPage(1); }} className="rounded border p-2"><option value="">{ui("Sva područja")}</option>{areas.map(a => <option key={a.id} value={a.slug}>{a.name}</option>)}</select></label>
                <label className="flex flex-col text-sm">{ui("Godina događaja")}<input type="number" min={1} max={9999} placeholder={ui("Sve godine")} value={year} onChange={e => { setYear(e.target.value); setPage(1); }} className="rounded border p-2" /></label>
                <label className="flex flex-col text-sm">{ui("Perspektiva")}<select value={perspective} onChange={e => { setPerspective(e.target.value as ContentTimePerspective | ''); setPage(1); }} className="rounded border p-2"><option value="">{ui("Sve perspektive")}</option><option value="Jucer">{ui("Jučer")}</option><option value="Danas">{ui("Danas")}</option><option value="Sutra">{ui("Sutra")}</option></select></label>
                <label className="flex flex-col text-sm">{ui("Oznaka")}<select value={tag} onChange={e => { setTag(e.target.value); setPage(1); }} className="rounded border p-2"><option value="">{ui("Sve oznake")}</option>{tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            </div>

            {filterError && <p role="alert" className="mb-4 text-sm text-amber-700">{ui(filterError)}</p>}
            {loading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                    {t('gallery.page.loading', 'Učitavanje galerije...')}
                </div>
            )}

            {error && !loading && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                    {ui(error)}
                </div>
            )}

            {!loading && !error && (
                <>
                    {albums.length === 0 ? (
                        <p className="text-center text-slate-600 dark:text-white/70">{t('gallery.page.empty', 'Galerija je trenutno prazna.')}</p>
                    ) : (
                        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {albums.map(album => {
                                const cover = album.coverImage;
                                return (
                                    <li
                                        key={album.id}
                                        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5"
                                    >
                                        <Link to={`/galerija/${album.id}`} className="block h-full">
                                            <div className="relative w-full overflow-hidden" style={{ paddingBottom: '66%' }}>
                                                {cover ? (
                                                    <img
                                                        src={`${API_BASE_URL}/api/gallery/${cover.id}/media`}
                                                        alt={cover.title}
                                                        loading="lazy"
                                                        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                        {t('gallery.list.noCover', 'Bez naslovne fotografije')}
                                                        </div>
                                                )}
                                            </div>
                                            <div className="space-y-2 p-4 text-slate-700 dark:text-white/80">
                                                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{album.title}</h2>
                                                <p className="text-sm">{album.eventDate ? new Date(`${album.eventDate}T00:00:00`).toLocaleDateString(locale) : ui("Datum događaja nije poznat")}{album.photographer ? ` · ${album.photographer}` : ''}</p>
                                                {(album.area || album.timePerspective) && (
                                                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        {album.area && <span>{album.area.name}</span>}
                                                        {album.timePerspective && (
                                                            <span>{album.timePerspective === 'Jucer' ? ui("Jučer") : ui(album.timePerspective)}</span>
                                                        )}
                                                    </div>
                                                )}
                                                {album.description && (
                                                    <p className="text-sm text-slate-600 dark:text-white/60">{album.description}</p>
                                                )}
                                                {album.relatedNewsSlug && (
                                                    <p className="text-xs text-blue-600 dark:text-blue-300">
                                                        {t('gallery.list.relatedNews', 'Povezano s novosti ')}
                                                        <span className="font-semibold">
                                                            {album.relatedNewsTitle ?? album.relatedNewsSlug}
                                                        </span>
                                                    </p>
                                                )}
                                                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-white/50">
                                                    {album.imageCount === 1
                                                        ? t('gallery.page.itemCount.single', '1 fotografija')
                                                        : t('gallery.page.itemCount.multiple', '{count} fotografija').replace('{count}', album.imageCount.toString())}
                                                </p>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}
            {!loading && !error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} />}
        </div>
    );
}
