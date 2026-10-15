import { MEDIA_ACCEPT, readMediaBase64, validateGalleryFile } from '@/lib/gallery-upload';
import TranslationEditor from '@/components/common/LazyTranslationEditor';
import type { ContentTranslation, TranslationEdit } from '@/lib/content-translations';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import React, { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createGalleryItem, fetchGalleryAlbum, fetchGalleryAlbumsPage, fetchGalleryItem, updateGalleryItem } from '@/lib/gallery-api';
import type { GalleryAlbumSummary } from '@/lib/types';

export default function PortalGalleryForm() {
    const { ui } = useUiTranslation();
    const { itemId } = useParams<{ itemId?: string }>();
    const isEdit = Boolean(itemId);
    const { getAccessToken } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const albumIdParam = searchParams.get('albumId');

    const [savedTranslations, setSavedTranslations] = useState<ContentTranslation[]>([]);
    const [translationEdits, setTranslationEdits] = useState<TranslationEdit[]>([]);
    const [translationBusy, setTranslationBusy] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isFeatured, setIsFeatured] = useState(false);
    const [mediaType, setMediaType] = useState<'Image' | 'Video'>('Image');
    const [file, setFile] = useState<File | null>(null);
    const [albums, setAlbums] = useState<GalleryAlbumSummary[]>([]);
    const [albumsLoading, setAlbumsLoading] = useState(true);
    const [albumPage, setAlbumPage] = useState(1);
    const [hasMoreAlbums, setHasMoreAlbums] = useState(false);
    const [albumLoadError, setAlbumLoadError] = useState<string | null>(null);
    const [albumRevision, setAlbumRevision] = useState(0);
    const [albumId, setAlbumId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [loadingItem, setLoadingItem] = useState(isEdit);

    const backTarget = albumId ? `/portal/gallery/${albumId}` : '/portal/gallery';

    useEffect(() => {
        if (!isEdit) { setAlbumId(''); setAlbums([]); setAlbumPage(1); }
    }, [albumIdParam, isEdit]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        setAlbumsLoading(true);
        setAlbumLoadError(null);
        getAccessToken().then(async token => {
            if (!token) throw new Error('Sesija je istekla.');
            const result = await fetchGalleryAlbumsPage({ authorization: token, includeUnpublished: true, editableOnly: true, page: albumPage, signal: controller.signal });
            // A direct link to an older album must never silently select the first recent album instead.
            const preferred = albumPage === 1 && albumIdParam && !isEdit
                ? (await fetchGalleryAlbum(Number(albumIdParam), token)).album : null;
            if (preferred && !preferred.canEdit) throw new Error('Nemate pravo dodavati zapise u odabrani album.');
            return { ...result, preferred };
        }).then(({ items, hasMore, preferred }) => {
                if (active) {
                    setAlbums(previous => [...new Map([...previous, ...items, ...(preferred ? [preferred] : [])].map(album => [album.id, album])).values()]);
                    setHasMoreAlbums(hasMore);
                    if (!isEdit) setAlbumId(current => current || String(preferred?.id ?? items[0]?.id ?? ''));
                }
            })
            .catch(err => {
                if (active) {
                    setAlbumLoadError(err instanceof Error ? err.message : 'Neuspjelo učitavanje albuma.');
                }
            })
            .finally(() => {
                if (active) {
                    setAlbumsLoading(false);
                }
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [albumIdParam, getAccessToken, albumPage, albumRevision, isEdit]);

    useEffect(() => {
        if (!isEdit || !itemId) {
            setLoadingItem(false);
            return;
        }

        let active = true;

        const loadItem = async () => {
            try {
                const token = await getAccessToken();
                if (!token) throw new Error('Sesija je istekla.');
                const item = await fetchGalleryItem(Number.parseInt(itemId, 10), token);
                const { album } = await fetchGalleryAlbum(item.albumId, token);
                if (!album.canEdit) throw new Error('Nemate pravo uređivati zapise ovog albuma.');
                if (!active) {
                    return;
                }

                setTitle(item.title);

                setSavedTranslations(item.translations ?? []);

                setTranslationEdits([]);
                setDescription(item.description ?? '');
                setIsFeatured(item.isFeatured);
                setMediaType(item.mediaType);
                setAlbumId(String(item.albumId));
                setAlbums(previous => [...new Map([...previous, album].map(value => [value.id, value])).values()]);
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Neuspjesno ucitavanje zapisa.');
                }
            } finally {
                if (active) {
                    setLoadingItem(false);
                }
            }
        };

        void loadItem();

        return () => {
            active = false;
        };
    }, [isEdit, itemId, getAccessToken]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        event.target.value = '';
        if (!selected) return;
        setError(null);
        try {
            const metadata = validateGalleryFile(selected);
            setFile(selected);
            setMediaType(metadata.mediaType);
        } catch (reason) {
            setFile(null);
            setError(reason instanceof Error ? reason.message : 'Datoteka nije podržana.');
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (translationBusy) return;
        setError(null);

        if (!title.trim()) {
            setError('Naslov je obavezan.');
            return;
        }

        if (!albumId) {
            setError('Odaberite album.');
            return;
        }

        if (!isEdit && !file) {
            setError('Odaberite datoteku.');
            return;
        }

        setSubmitting(true);

        try {
            const token = await getAccessToken();
            if (!token) {
                setError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            if (isEdit && itemId) {
                await updateGalleryItem(
                    Number.parseInt(itemId, 10),
                    {
                        translations: translationEdits,
                        title: title.trim(),
                        description: description || undefined,
                        isFeatured,
                    },
                    token
                );
            } else if (file) {
                const metadata = validateGalleryFile(file);
                const base64Data = await readMediaBase64(file);
                await createGalleryItem(
                    {
                        translations: translationEdits,
                        title: title.trim(),
                        description: description || undefined,
                        isFeatured,
                        mediaType: metadata.mediaType,
                        contentType: metadata.contentType,
                        fileName: file.name || undefined,
                        base64Data,
                        albumId: Number.parseInt(albumId, 10),
                    },
                    token
                );
            }

            navigate(backTarget);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Spremanje nije uspjelo.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingItem) {
        return <p className="text-sm text-slate-500">{ui("Ucitavanje zapisa...")}</p>;
    }

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                    {isEdit ? ui("Uredi zapis galerije") : ui("Novi zapis galerije")}
                </h2>
                <button
                    type="button"
                    onClick={() => navigate(backTarget)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {ui("Nazad")} </button>
            </div>

            {error && <p className="text-sm text-red-600">{ui(error)}</p>}
            {albumLoadError && <p role="alert" className="text-sm text-red-600">{ui(albumLoadError)} <button type="button" onClick={() => setAlbumRevision(value => value + 1)} className="underline">{ui("Pokušaj ponovno")}</button></p>}

            {albumsLoading ? (
                <p className="text-sm text-slate-500">{ui("Učitavanje albuma...")}</p>
            ) : !albumLoadError && albums.length === 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {ui("Nema albuma koje smijete uređivati.")}{' '}
                    <button
                        type="button"
                        onClick={() => navigate('../albums/new')}
                        className="font-semibold underline underline-offset-4"
                    >
                        {ui("Kreirajte prvi album")} </button>{' '}
                    {ui("kako biste mogli dodati fotografije.")} </div>
            ) : (
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Album *")}</span>
                    <div className="mt-1 flex gap-2">
                        <select
                            value={albumId}
                            onChange={event => setAlbumId(event.target.value)}
                            required
                            disabled={isEdit}
                            className="w-full rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                        >
                            {albums.map(album => (
                                <option key={album.id} value={album.id}>
                                    {album.title}
                                </option>
                            ))}
                        </select>
                        {!isEdit && (
                            <button
                                type="button"
                                onClick={() => navigate('../albums/new')}
                                className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                            >
                                {ui("Novi album")} </button>
                        )}
                    </div>
                </label>
            )}

            {!isEdit && hasMoreAlbums && !albumLoadError && <button type="button" disabled={albumsLoading} onClick={() => setAlbumPage(value => value + 1)} className="text-sm text-blue-700 underline disabled:opacity-40">{ui("Učitaj još albuma")}</button>}

            <label className="flex flex-col text-sm">
                <span className="font-semibold text-slate-600">{ui("Naslov *")}</span>
                <input
                    type="text"
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    required
                    className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            <label className="flex flex-col text-sm">
                <span className="font-semibold text-slate-600">{ui("Opis")}</span>
                <textarea
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    rows={4}
                    className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            {!isEdit && (
                <>
<p className="text-sm text-slate-600">{ui("JPG, PNG, GIF, WebP, MP4 ili WebM, do 20 MiB. Format se prepoznaje iz datoteke.")}</p>

                    <label className="flex flex-col text-sm">
                        <span className="font-semibold text-slate-600">{ui("Datoteka *")}</span>
                        <input type="file" accept={MEDIA_ACCEPT} onChange={handleFileChange} disabled={submitting} className="mt-1 max-w-full" />
                        {file && (
                            <p className="text-xs text-slate-500">{file.name} ({ui(mediaType === 'Image' ? 'Slika' : 'Video')}) &bull; {(file.size / 1024).toFixed(1)} KB</p>
                        )}
                    </label>
                    <details className="text-sm"><summary className="cursor-pointer">{ui('Fotografiraj kamerom')}</summary>
                        <label className="mt-2 block">{ui('Kamera (ako je uređaj podržava)')}
                            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFileChange} disabled={submitting} className="mt-1 block max-w-full" />
                        </label>
                    </details>
                </>
            )}

            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isFeatured} onChange={event => setIsFeatured(event.target.checked)} className="h-4 w-4" />
                <span className="font-semibold text-slate-600">{ui("Istaknuto")}</span>
            </label>

            <TranslationEditor key={itemId ?? 'new'} source={{ title, description }} saved={savedTranslations} edits={translationEdits} onChange={setTranslationEdits} onBusyChange={setTranslationBusy} disabled={translationBusy || submitting} />

            <button
                type="submit"
                disabled={translationBusy || submitting || albumsLoading || Boolean(albumLoadError) || !albumId}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
                {submitting ? ui("Spremanje...") : isEdit ? ui("Spremi promjene") : ui("Spremi")}
            </button>
        </form>
    );
}
