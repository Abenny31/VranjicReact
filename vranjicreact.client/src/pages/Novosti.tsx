import ContributionActions from '@/components/common/ContributionActions';
import TagFilter, { parseTagId } from '@/components/common/TagFilter';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchNewsPage } from '@/lib/news-api';
import type { NewsSummary } from '@/lib/types';

export default function Novosti() {
    const { ui } = useUiTranslation();
    const { t, language } = useLanguage();
    const [items, setItems] = useLocalizedContentState<NewsSummary[]>([]);
    const [params, setParams] = useSearchParams();
    const tagId = parseTagId(params.get('tagId'));
    const requestedPage = Number(params.get('page') ?? 1);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
    const setPage = (value: number) => {
        const next = new URLSearchParams(params);
        next.set('page', String(value)); setParams(next);
    };
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'hr-HR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }),
        [language]
    );

    const formatDate = useCallback(
        (value: string | null) => {
            const pendingLabel = t('news.page.datePending', 'U pripremi');
            if (!value) {
                return pendingLabel;
            }
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? pendingLabel : dateFormatter.format(date);
        },
        [dateFormatter, t]
    );

    const loadErrorMessage = 'Neuspjesno ucitavanje novosti.';

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null);
        let isMounted = true;

        fetchNewsPage({ page, tagId, signal: controller.signal })
            .then(list => {
                if (isMounted) {
                    setItems(list.items); setHasMore(list.hasMore);
                }
            })
            .catch(err => {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : loadErrorMessage;
                    setError(message);
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
    }, [loadErrorMessage, page, tagId, setItems]);

    return (
        <div className="mx-auto max-w-5xl px-4 py-12">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                    {t('news.page.title', 'Novosti')}
                </h1>
                <p className="mt-3 text-slate-600 dark:text-white/70">
                    {t('news.page.description', 'Sve objave i price iz djelovanja udruge.')}
                </p>
            </header>
            <ContributionActions kind="obavijest" tagId={tagId ? String(tagId) : undefined} />
            <div className="mb-6"><TagFilter value={tagId} onChange={value => {
                const next = new URLSearchParams(params);
                if (value) next.set('tagId', value); else next.delete('tagId');
                next.delete('page'); setParams(next);
            }} /></div>

            {loading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                    {t('news.page.loading', 'Ucitavanje novosti...')}
                </div>
            )}

            {error && !loading && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                    {ui(error)}
                </div>
            )}

            {!loading && !error && (
                <div className="space-y-8">
                    {items.length === 0 ? (
                        <p className="text-center text-slate-600 dark:text-white/70">
                            {t('news.page.empty', 'Trenutno nema objavljenih novosti.')}
                        </p>
                    ) : (
                        items.map(item => (
                            <article
                                key={item.id}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-white/5"
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
                                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                                        <Link
                                            to={`/novosti/${item.slug}`}
                                            className="transition hover:text-primary-700 dark:hover:text-blue-200"
                                        >
                                            {item.title}
                                        </Link>
                                    </h2>
                                    <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-white/50">
                                        {formatDate(item.publishedAt)}
                                    </p>
                                </div>
                                {item.heroImageUrl && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/10">
                                        <img
                                            src={item.heroImageUrl}
                                            alt={item.title}
                                            className="h-48 w-full object-cover"
                                        />
                                    </div>
                                )}
                                {(item.area || item.timePerspective) && (
                                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {item.area && (
                                            <Link
                                                to={`/nase-malo-misto/${item.area.slug}`}
                                                className="rounded-full bg-slate-100 px-3 py-1 hover:text-primary-700"
                                            >
                                                {item.area.name}
                                            </Link>
                                        )}
                                        {item.timePerspective && (
                                            <span className="rounded-full bg-slate-100 px-3 py-1">
                                                {item.timePerspective === 'Jucer' ? ui("Jučer") : ui(item.timePerspective)}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <p className="mt-4 text-slate-600 dark:text-white/70">{item.excerpt}</p>
                                <div className="mt-6">
                                    <Link
                                        to={`/novosti/${item.slug}`}
                                        className="text-sm font-semibold text-primary-700 hover:text-primary-900 dark:text-blue-300 dark:hover:text-blue-200"
                                    >
                                        {t('news.page.readMore', 'Procitaj vise >>')}
                                    </Link>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            )}
            {!loading && !error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} />}
        </div>
    );
}
