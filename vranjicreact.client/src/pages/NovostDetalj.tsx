import ShareContent from '@/components/common/ShareContent';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_BASE_URL } from '@/lib/api-client';
import { fetchGalleryAlbum } from '@/lib/gallery-api';
import { fetchNewsDetail } from '@/lib/news-api';
import type { GalleryAlbumDetail, NewsDetail } from '@/lib/types';


function asParagraphs(body: string) {
    return body
        .split(/\r?\n\r?\n/)
        .map(chunk => chunk.trim())
        .filter(Boolean);
}

export default function NovostDetalj() {
    const { ui, locale } = useUiTranslation();
    const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }), [locale]);
    const { t } = useLanguage();
    const { slug } = useParams();
    const [data, setData] = useLocalizedContentState<NewsDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [album, setAlbum] = useLocalizedContentState<GalleryAlbumDetail | null>(null);
    const [albumError, setAlbumError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) {
            setError('Novost nije pronadena.');
            setLoading(false);
            return;
        }

        let isMounted = true;
        fetchNewsDetail(slug)
            .then(detail => {
                if (isMounted) {
                    setData(detail);
                }
            })
            .catch(err => {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Neuspjelo ucitavanje novosti.');
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [slug, setData, setAlbum]);

    const paragraphs = useMemo(() => (data ? asParagraphs(data.body) : []), [data]);

    useEffect(() => {
        if (!data?.galleryAlbumId) {
            setAlbum(null);
            setAlbumError(null);
            return;
        }

        let active = true;
        setAlbumError(null);
        fetchGalleryAlbum(data.galleryAlbumId)
            .then(detail => {
                if (active) {
                    setAlbum(detail);
                }
            })
            .catch(err => {
                if (active) {
                    const message = err instanceof Error ? err.message : 'Neuspjelo ucitavanje galerije.';
                    setAlbumError(message);
                }
            });

        return () => {
            active = false;
        };
    }, [data?.galleryAlbumId, setData, setAlbum]);

    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <Link
                to="/novosti"
                className="inline-flex items-center text-sm font-semibold text-primary-700 transition hover:text-primary-900 dark:text-blue-300 dark:hover:text-blue-200"
            >
                {ui("Povratak na obavijesti")} </Link>

            {loading && (
                <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                    {t('news.detail.loading', 'Ucitavanje objave...')}
                </div>
            )}

            {error && !loading && (
                <div className="mt-12 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                    {ui(error)}
                </div>
            )}

            {!loading && !error && data && (
                <article className="mt-10 space-y-6">
                    <header className="space-y-3">
                        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-white/50">
                            {data.publishedAt ? formatter.format(new Date(data.publishedAt)) : t('news.page.datePending', 'U pripremi')}
                        </p>
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{data.title}</h1>
                        {data.source && <p className="text-sm text-slate-500 dark:text-white/60">{t('news.detail.source', 'Izvor:')} {data.source}</p>}
                    </header>
                    <ShareContent title={data.title} text={data.excerpt} path={`/novosti/${data.id}`} />

                    {data.heroImageUrl && (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                            <img src={data.heroImageUrl} alt={data.title} className="w-full object-cover" />
                        </div>
                    )}

                    <div className="space-y-4 text-slate-700 leading-relaxed dark:text-white/80">
                        {paragraphs.length > 0 ? (
                            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
                        ) : (
                            <p>{data.body}</p>
                        )}
                    </div>

                    {albumError && <p className="text-sm text-red-600">{ui(albumError)}</p>}

                    {album && album.images.length > 0 && (
                        <section className="space-y-3">
                            <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{t('news.detail.gallery', 'Galerija s dogadaja')}</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {album.images.map(image => (
                                    <figure
                                        key={image.id}
                                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5"
                                    >
                                        <img
                                            src={`${API_BASE_URL}/api/gallery/${image.id}/media`}
                                            alt={image.title}
                                            className="h-56 w-full object-cover"
                                        />
                                        <figcaption className="p-3 text-sm text-slate-600 dark:text-white/70">
                                            {image.title}
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </section>
                    )}
                </article>
            )}
        </div>
    );
}
