import ContributionActions from '@/components/common/ContributionActions';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAnnouncementsPage } from '@/lib/announcements-api';
import type { AnnouncementSummary } from '@/lib/types';

const importanceLabel = {
    Normal: 'Obavijest',
    Important: 'Važno',
    Urgent: 'Hitno',
} as const;

function AnnouncementCard({ item }: { item: AnnouncementSummary }) {
    const { ui, locale } = useUiTranslation();
    const accent = item.importance === 'Urgent'
        ? 'border-red-300 bg-red-50'
        : item.importance === 'Important'
          ? 'border-amber-300 bg-amber-50'
          : 'border-slate-200 bg-white';

    return (
        <article className={`rounded-2xl border p-6 shadow-sm ${accent}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>{ui(importanceLabel[item.importance])}</span>
                {item.area && (
                    <Link to={`/nase-malo-misto/${item.area.slug}`} className="text-primary-700 hover:underline">
                        {item.area.name}
                    </Link>
                )}
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
                <Link to={`/obavijesti/${item.slug}`} className="hover:text-primary-700">
                    {item.title}
                </Link>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.summary}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">
                    {ui("Od")} {new Date(item.startsAt).toLocaleDateString(locale)}
                    {item.expiresAt && ui(' do {date}', { date: new Date(item.expiresAt).toLocaleDateString(locale) })}
                </span>
                <Link to={`/obavijesti/${item.slug}`} className="font-semibold text-primary-700">
                    {ui("Detalji →")} </Link>
            </div>
        </article>
    );
}

export default function Obavijesti() {
    const { ui } = useUiTranslation();
    const [items, setItems] = useLocalizedContentState<AnnouncementSummary[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null);
        let active = true;
        fetchAnnouncementsPage({ page, signal: controller.signal, includeExpired: true })
            .then(result => {
                if (active) {
                    setItems(result.items); setHasMore(result.hasMore);
                }
            })
            .catch(reason => {
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'Obavijesti se ne mogu učitati.');
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            controller.abort();
            active = false;
        };
    }, [page, setItems]);

    const activeItems = useMemo(() => items.filter(item => item.isActive), [items]);
    const archivedItems = useMemo(() => items.filter(item => item.isExpired), [items]);

    return (
        <div className="mx-auto max-w-6xl px-4 py-12">
            <header className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">{ui("Aktualno")}</p>
                <h1 className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">{ui("Obavijesti")}</h1>
                <p className="mt-4 text-slate-600 dark:text-white/70">
                    {ui("Važne informacije, rokovi i obavijesti za Vranjic i njegova područja.")} </p>
            </header>
            <ContributionActions kind="obavijest" />

            {loading && <p className="mt-10 text-slate-500">{ui("Učitavanje obavijesti...")}</p>}
            {error && <p className="mt-10 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{ui(error)}</p>}

            {!loading && !error && (
                <>
                    <section className="mt-10">
                        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{ui("Aktivne obavijesti")}</h2>
                        {activeItems.length === 0 ? (
                            <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
                                {ui("Na ovoj stranici nema aktivnih obavijesti.")} </p>
                        ) : (
                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                {activeItems.map(item => <AnnouncementCard key={item.id} item={item} />)}
                            </div>
                        )}
                    </section>

                    {archivedItems.length > 0 && (
                        <section className="mt-14">
                            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{ui("Arhiva")}</h2>
                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                {archivedItems.map(item => <AnnouncementCard key={item.id} item={item} />)}
                            </div>
                        </section>
                    )}
                </>
            )}
            {!loading && !error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} />}
        </div>
    );
}
