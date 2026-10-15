import { useUiTranslation } from '@/hooks/useUiTranslation';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import type { HomeResponse } from '@/lib/types';


function formatDate(value: string | null, pendingLabel: string, locale: string) {
    if (!value) {
        return pendingLabel;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? pendingLabel : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed);
}

interface HomeTopNewsProps {
    response: HomeResponse | null;
    loading: boolean;
    error: string | null;
}

export default function HomeTopNews({ response, loading, error }: HomeTopNewsProps) {
    const { ui, locale } = useUiTranslation();
    const { t } = useLanguage();
    const items = response?.latestNews.slice(0, 3) ?? [];

    if (loading) {
        return (
            <section className="bg-primary-50 py-12 dark:bg-slate-900">
                <div className="mx-auto max-w-6xl px-4">
                    <header className="mb-8">
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{ui("Obavijesti")}</p>
                        <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{t('home.news.title', 'Sto ima novo?')}</h2>
                    </header>
                    <div className="rounded-2xl border border-primary-100 bg-white/80 p-8 text-center text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        {t('home.news.loading', 'Ucitavanje novosti...')}
                    </div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="bg-primary-50 py-12 dark:bg-slate-900">
                <div className="mx-auto max-w-6xl px-4">
                    <header className="mb-8">
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{ui("Obavijesti")}</p>
                        <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{t('home.news.title', 'Sto ima novo?')}</h2>
                    </header>
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
                        {ui(error)}
                    </div>
                </div>
            </section>
        );
    }

    if (items.length === 0) {
        return (
            <section className="bg-primary-50 py-12 dark:bg-slate-900">
                <div className="mx-auto max-w-6xl px-4">
                    <header className="mb-8">
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{ui("Obavijesti")}</p>
                        <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{t('home.news.title', 'Sto ima novo?')}</h2>
                    </header>
                    <div className="rounded-2xl border border-primary-100 bg-white/80 p-8 text-center text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        {t('home.news.empty', 'Trenutno nema objavljenih novosti.')}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-primary-50 py-12 dark:bg-slate-900">
            <div className="mx-auto max-w-6xl px-4">
                <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{ui("Obavijesti")}</p>
                        <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{t('home.news.title', 'Sto ima novo?')}</h2>
                        <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">{t('home.news.description', 'Pogledajte posljednje objave iz rada Udruge Don Frane Bulic.')}</p>
                    </div>
                    <Link
                        to="/aktualno"
                        className="inline-flex items-center text-sm font-semibold text-primary-700 transition hover:text-primary-900 dark:text-primary-200 dark:hover:text-primary-100"
                    >
                        {ui("Sve obavijesti")} </Link>
                </header>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => (
                        <article key={item.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-black/20">
                            {item.heroImageUrl && (
                                <div className="aspect-[16/9] overflow-hidden">
                                    <img
                                        src={item.heroImageUrl}
                                        alt={item.title}
                                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                                        loading="lazy"
                                    />
                                </div>
                            )}
                            <div className="flex flex-1 flex-col p-6">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-200">
                                    {formatDate(item.publishedAt, t('news.page.datePending', 'U pripremi'), locale)}
                                </p>
                                <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                                    <Link to={`/novosti/${item.slug}`} className="transition hover:text-primary-700 dark:hover:text-primary-200">
                                        {item.title}
                                    </Link>
                                </h3>
                                <p className="mt-3 flex-1 text-sm text-slate-600 dark:text-slate-300">{item.excerpt}</p>
                                <div className="mt-6">
                                    <Link
                                        to={`/novosti/${item.slug}`}
                                        className="text-sm font-semibold text-primary-700 transition hover:text-primary-900 dark:text-primary-200 dark:hover:text-primary-100"
                                    >
                                        {t('news.page.readMore', 'Procitaj vise >>')}
                                    </Link>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
