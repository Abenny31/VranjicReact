import ShareContent from '@/components/common/ShareContent';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchAnnouncementDetail } from '@/lib/announcements-api';
import type { AnnouncementDetail } from '@/lib/types';

export default function ObavijestDetalj() {
    const { ui, locale } = useUiTranslation();
    const { slug } = useParams<{ slug: string }>();
    const [item, setItem] = useLocalizedContentState<AnnouncementDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) {
            setError('Obavijest nije pronađena.');
            setLoading(false);
            return;
        }

        let active = true;
        fetchAnnouncementDetail(slug)
            .then(result => {
                if (active) {
                    setItem(result);
                }
            })
            .catch(reason => {
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'Obavijest se ne može učitati.');
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [slug, setItem]);

    const paragraphs = useMemo(
        () => item?.body.split(/\r?\n\r?\n/).map(value => value.trim()).filter(Boolean) ?? [],
        [item]
    );

    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <Link to="/obavijesti" className="text-sm font-semibold text-primary-700 dark:text-blue-300">
                {ui("← Sve obavijesti")} </Link>

            {loading && <p className="mt-10 text-slate-500">{ui("Učitavanje obavijesti...")}</p>}
            {error && <p className="mt-10 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{ui(error)}</p>}

            {!loading && !error && item && (
                <article className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <header>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
                            <span>{item.importance === 'Urgent' ? ui("Hitno") : item.importance === 'Important' ? ui("Važno") : ui("Obavijest")}</span>
                            {item.isExpired && <span>{ui("Arhiva")}</span>}
                            {item.area && (
                                <Link to={`/nase-malo-misto/${item.area.slug}`} className="text-primary-700 dark:text-blue-300">
                                    {item.area.name}
                                </Link>
                            )}
                        </div>
                        <h1 className="mt-3 text-4xl font-bold text-slate-900 dark:text-white">{item.title}</h1>
                        <p className="mt-4 text-lg text-slate-600 dark:text-white/70">{item.summary}</p>
                        <p className="mt-4 text-sm text-slate-500 dark:text-white/50">
                            {ui("Vrijedi od")} {new Date(item.startsAt).toLocaleString(locale)}
                            {item.expiresAt && ui(' do {date}', { date: new Date(item.expiresAt).toLocaleString(locale) })}
                        </p>
                    </header>
                    <ShareContent title={item.title} text={item.summary} path={`/obavijesti/${item.id}`} />

                    <div className="mt-8 space-y-4 leading-relaxed text-slate-700 dark:text-white/80">
                        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>

                    {item.tags.length > 0 && (
                        <div className="mt-8 flex flex-wrap gap-2">
                            {item.tags.map(tag => (
                                <span key={tag.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {item.actionUrl && item.actionLabel && (
                        <a
                            href={item.actionUrl}
                            className="mt-8 inline-flex rounded-lg bg-primary-600 px-5 py-3 font-semibold text-white transition hover:bg-primary-700"
                            {...(item.actionUrl.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                        >
                            {item.actionLabel}
                        </a>
                    )}
                </article>
            )}
        </div>
    );
}
