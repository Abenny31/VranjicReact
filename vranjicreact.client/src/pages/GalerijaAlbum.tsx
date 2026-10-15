import ShareContent from '@/components/common/ShareContent';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_BASE_URL } from '@/lib/api-client';
import { fetchGalleryAlbum } from '@/lib/gallery-api';
import type { GalleryAlbumDetail } from '@/lib/types';

export default function GalerijaAlbum() {
    const { ui, locale } = useUiTranslation();
    const { t } = useLanguage();
    const { albumId } = useParams();
    const [album, setAlbum] = useLocalizedContentState<GalleryAlbumDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!albumId) {
            setError('Album nije pronađen.');
            setLoading(false);
            return;
        }

        const id = Number.parseInt(albumId, 10);
        if (Number.isNaN(id)) {
            setError('Album nije pronađen.');
            setLoading(false);
            return;
        }

        let active = true;

        fetchGalleryAlbum(id)
            .then(response => {
                if (active) {
                    setAlbum(response);
                }
            })
            .catch(err => {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Neuspjelo učitavanje albuma.');
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
    }, [albumId, setAlbum]);

    const images = album?.images ?? [];

    const selectedItem = useMemo(() => {
        if (selectedIndex === null || !album) {
            return null;
        }
        return album.images[selectedIndex] ?? null;
    }, [album, selectedIndex]);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedIndex(null);
            } else if (event.key === 'ArrowRight') {
                setSelectedIndex(prev => {
                    if (prev === null || images.length === 0) {
                        return prev;
                    }
                    return (prev + 1) % images.length;
                });
            } else if (event.key === 'ArrowLeft') {
                setSelectedIndex(prev => {
                    if (prev === null || images.length === 0) {
                        return prev;
                    }
                    return (prev - 1 + images.length) % images.length;
                });
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [images.length, setAlbum]);

    return (
        <div className="mx-auto max-w-6xl px-4 py-12">
            <Link
                to="/galerija"
                className="inline-flex items-center text-sm font-semibold text-primary-700 transition hover:text-primary-900 dark:text-blue-300 dark:hover:text-blue-200"
            >
                {ui("← Povratak na galeriju")} </Link>

            {loading && (
                <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                    {t('gallery.album.loading', 'Učitavanje albuma...')}
                </div>
            )}

            {error && !loading && (
                <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                    {ui(error)}
                </div>
            )}

            {!loading && !error && album && (
                <>
                    <header className="mt-10 text-center">
                        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{album.album.title}</h1>
                        <p className="mt-2 text-sm">{album.album.eventDate ? new Date(`${album.album.eventDate}T00:00:00`).toLocaleDateString(locale) : ui("Datum događaja nije poznat")}{album.album.photographer ? ui(' · Autor / fotograf: {name}', { name: album.album.photographer }) : ''}</p>
                        {album.album.description && (
                            <p className="mt-3 text-base text-slate-600 dark:text-white/70">{album.album.description}</p>
                        )}
                        <p className="mt-2 text-sm text-slate-500 dark:text-white/60">
                            {album.images.length === 1
                                ? t('gallery.page.itemCount.single', '1 fotografija')
                                : t('gallery.page.itemCount.multiple', '{count} fotografija').replace('{count}', album.images.length.toString())}
                        </p>
                    </header>
                    <ShareContent title={album.album.title} text={album.album.description ?? undefined} path={`/galerija/${album.album.id}`} />

                    {album.images.length === 0 ? (
                        <p className="mt-10 text-center text-slate-600 dark:text-white/70">{t('gallery.album.empty', 'Album je trenutno prazan.')}</p>
                    ) : (
                        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {album.images.map((item, index) => (
                                <li
                                    key={item.id}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5"
                                >
                                    <button
                                        type="button"
                                        className="block w-full cursor-pointer"
                                        onClick={() => setSelectedIndex(index)}
                                    >
                                        <div className="relative w-full overflow-hidden" style={{ paddingBottom: '66%' }}>
                                            {item.mediaType === 'Image' ? (
                                                <img
                                                    src={`${API_BASE_URL}/api/gallery/${item.id}/media`}
                                                    alt={item.title}
                                                    loading="lazy"
                                                    className="absolute inset-0 h-full w-full object-cover transition duration-300 hover:scale-105"
                                                />
                                            ) : (
                                                <video
                                                    src={`${API_BASE_URL}/api/gallery/${item.id}/media`}
                                                    controls
                                                    className="absolute inset-0 h-full w-full object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-2 p-4 text-left text-slate-700 dark:text-white/80">
                                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h2>
                                            {item.description && (
                                                <p className="text-sm text-slate-600 dark:text-white/60">{item.description}</p>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10">
                    <button
                        type="button"
                        aria-label={ui("Zatvori prikaz")}
                        className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                        onClick={() => setSelectedIndex(null)}
                    >
                        ✕
                    </button>

                    {images.length > 1 && (
                        <>
                            <button
                                type="button"
                                aria-label={ui("Prethodna slika")}
                                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/30"
                                onClick={() =>
                                    setSelectedIndex(prev => {
                                        if (prev === null) {
                                            return prev;
                                        }
                                        return (prev - 1 + images.length) % images.length;
                                    })
                                }
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                aria-label={ui("Sljedeća slika")}
                                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/30"
                                onClick={() =>
                                    setSelectedIndex(prev => {
                                        if (prev === null) {
                                            return prev;
                                        }
                                        return (prev + 1) % images.length;
                                    })
                                }
                            >
                                ›
                            </button>
                        </>
                    )}

                    <div className="max-h-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        {selectedItem.mediaType === 'Image' ? (
                            <img
                                src={`${API_BASE_URL}/api/gallery/${selectedItem.id}/media`}
                                alt={selectedItem.title}
                                className="h-full max-h-[80vh] w-full object-contain"
                            />
                        ) : (
                            <video
                                src={`${API_BASE_URL}/api/gallery/${selectedItem.id}/media`}
                                controls
                                autoPlay
                                className="h-full max-h-[80vh] w-full object-contain"
                            />
                        )}

                        <div className="space-y-1 border-t border-slate-200 p-6 text-slate-700 dark:border-slate-700 dark:text-white/80">
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">{selectedItem.title}</p>
                            {selectedItem.description && (
                                <p className="text-sm text-slate-600 dark:text-white/60">{selectedItem.description}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
