import { useUiTranslation } from '@/hooks/useUiTranslation';
import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CONTENT_CREATE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import PortalMedia from '@/components/common/PortalMedia';
import EditorialPanel from '@/components/common/EditorialPanel';
import { createGalleryItem, deleteGalleryItem, fetchGalleryAlbum } from '@/lib/gallery-api';
import type { GalleryAlbumSummary, GalleryItem } from '@/lib/types';

interface UploadProgress {
    total: number;
    completed: number;
}

const stripExtension = (fileName: string) => fileName.replace(/\.[^/.]+$/, '');

const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                const commaIndex = result.indexOf(',');
                resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
            } else if (result instanceof ArrayBuffer) {
                const binary = String.fromCharCode(...new Uint8Array(result));
                resolve(btoa(binary));
            } else {
                reject(new Error('Neuspjesno citanje datoteke.'));
            }
        };
        reader.onerror = () => reject(new Error('Neuspjesno citanje datoteke.'));
        reader.readAsDataURL(file);
    });

export default function PortalGalleryAlbumDetail() {
    const { ui, locale } = useUiTranslation();
    const { albumId } = useParams<{ albumId: string }>();
    const numericAlbumId = useMemo(() => Number.parseInt(albumId ?? '', 10), [albumId]);
    const navigate = useNavigate();
    const { getAccessToken, hasRole } = useAuth();

    const [album, setAlbum] = useState<GalleryAlbumSummary | null>(null);
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | { failedFiles: string[] } | null>(null);
    const [bulkFiles, setBulkFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ total: 0, completed: 0 });
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);

    const canCreateItems = hasAnyRole(hasRole, CONTENT_CREATE_ROLES) && album?.canEdit === true;

    const loadAlbum = useCallback(async () => {
        if (!Number.isFinite(numericAlbumId)) {
            setError('Album nije pronaden.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const token = await getAccessToken();
            const detail = await fetchGalleryAlbum(numericAlbumId, token ?? undefined);
            setAlbum(detail.album);
            setImages(detail.images);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Neuspjesno ucitavanje albuma.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, numericAlbumId]);

    useEffect(() => {
        void loadAlbum();
    }, [loadAlbum]);

    const handleDelete = async (item: GalleryItem) => {
        if (!item.canDelete) {
            return;
        }

        const confirmed = window.confirm(ui("Zelite li obrisati ovu datoteku iz albuma?"));
        if (!confirmed) {
            return;
        }

        setActionError(null);

        try {
            const token = await getAccessToken();
            if (!token) {
                setActionError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await deleteGalleryItem(item.id, token);
            setImages(prev => prev.filter(current => current.id !== item.id));
            setAlbum(prev => (prev ? { ...prev, imageCount: Math.max(0, prev.imageCount - 1) } : prev));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Brisanje nije uspjelo.';
            setActionError(message);
        }
    };

    const handleBulkFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        setBulkFiles(files);
        setUploadMessage(null);
        setActionError(null);
        event.target.value = '';
    };

    const handleBulkUpload = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canCreateItems) {
            return;
        }

        if (!bulkFiles.length) {
            setActionError('Odaberite barem jednu datoteku.');
            return;
        }

        if (!Number.isFinite(numericAlbumId)) {
            setActionError('Album nije pronaden.');
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                setActionError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            setUploading(true);
            setUploadProgress({ total: bulkFiles.length, completed: 0 });
            setActionError(null);
            setUploadMessage(null);

            const failures: string[] = [];

            for (const file of bulkFiles) {
                try {
                    const base64 = await toBase64(file);
                    const mediaType = file.type.startsWith('video/') ? 'Video' : 'Image';

                    await createGalleryItem(
                        {
                            title: stripExtension(file.name),
                            description: undefined,
                            mediaType,
                            contentType: file.type || undefined,
                            fileName: file.name || undefined,
                            base64Data: base64,
                            isFeatured: false,
                            albumId: numericAlbumId,
                        },
                        token
                    );

                    setUploadProgress(prev => ({
                        total: prev.total,
                        completed: prev.completed + 1,
                    }));
                } catch (err) {
                    console.error('Bulk upload failed for', file.name, err);
                    failures.push(file.name);
                }
            }

            setBulkFiles([]);

            if (failures.length > 0) {
                setActionError({ failedFiles: failures });
            } else {
                setUploadMessage('Sve datoteke su uspjesno spremljene.');
            }

            await loadAlbum();
        } finally {
            setUploading(false);
            setUploadProgress({ total: 0, completed: 0 });
        }
    };

    const formatSize = (size: number) => {
        if (size < 1024) {
            return `${size} B`;
        }
        const kb = size / 1024;
        if (kb < 1024) {
            return `${kb.toFixed(1)} KB`;
        }
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    };

    if (!Number.isFinite(numericAlbumId)) {
        return (
            <div>
                <p className="text-sm text-red-600">{ui("Album nije pronaden.")}</p>
                <button
                    type="button"
                    onClick={() => navigate('..')}
                    className="mt-4 rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {ui("Nazad")} </button>
            </div>
        );
    }

    if (loading) {
        return <p className="text-sm text-slate-500">{ui("Ucitavanje albuma...")}</p>;
    }

    if (error) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-600">{ui(error)}</p>
                <button
                    type="button"
                    onClick={() => navigate('..')}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {ui("Nazad")} </button>
            </div>
        );
    }

    if (!album) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-600">{ui("Album nije pronaden.")}</p>
                <button
                    type="button"
                    onClick={() => navigate('..')}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {ui("Nazad")} </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-slate-800">{album.title}</h2>
                    {album.description && <p className="text-sm text-slate-600">{album.description}</p>}
                    <p className="text-xs text-slate-500">
                        {album.imageCount === 1 ? ui("1 datoteka") : ui('{count} datoteka', { count: album.imageCount })}
                    </p>
                    {album.relatedNewsId && album.relatedNewsSlug && (
                        <p className="mt-1 text-sm text-slate-600">
                            {ui("Povezana novost:")}{' '}
                            <Link
                                to={`/novosti/${album.relatedNewsSlug}`}
                                className="font-semibold text-blue-600 underline underline-offset-4"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {album.relatedNewsTitle ?? album.relatedNewsSlug}
                            </Link>{' '}
                            (<Link
                                to={`/portal/news/${album.relatedNewsId}/edit`}
                                className="text-xs font-semibold text-blue-500 underline underline-offset-4"
                            >
                                {ui("uredi")} </Link>)
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('..')}
                        className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                        {ui("Nazad")} </button>
                    {canCreateItems && (
                        <button
                            type="button"
                            onClick={() => navigate(`/portal/gallery/new?albumId=${album.id}`)}
                            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            {ui("Dodaj zapis")} </button>
                    )}
                </div>
            </div>

            {actionError && <p className="text-sm text-red-600">{typeof actionError === 'string'
                ? ui(actionError)
                : ui('Neke datoteke nisu spremljene: {files}', { files: actionError.failedFiles.join(', ') })}</p>}
            {uploadMessage && <p className="text-sm text-green-600">{ui(uploadMessage)}</p>}

            {canCreateItems && (
                <form className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4" onSubmit={handleBulkUpload}>
                    <h3 className="text-sm font-semibold text-slate-700">{ui("Brzo dodavanje vise datoteka")}</h3>
                    <div className="text-xs text-slate-500">
                        {ui("Odaberite slike ili video zapise koje zelite dodati ovom albumu. Naslovi ce automatski biti postavljeni prema nazivima datoteka, a kasnije ih mozete urediti.")} </div>
                    <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleBulkFilesChange}
                        disabled={uploading}
                    />
                    {bulkFiles.length > 0 && (
                        <p className="text-xs text-slate-500">
                            {ui("Odabrano")} {bulkFiles.length}  {ui("datoteka.")}{' '}
                            {uploading && ui('Obrada {completed}/{total}...', { completed: uploadProgress.completed, total: uploadProgress.total })}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={uploading || bulkFiles.length === 0}
                        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {uploading ? ui("Ucitavanje...") : ui("Dodaj datoteke")}
                    </button>
                </form>
            )}

            {album && <EditorialPanel type="Gallery" id={album.id} status={album.editorialStatus} rowVersion={album.rowVersion} canSubmit={album.canSubmit} canViewHistory={album.canViewHistory} onChanged={() => void loadAlbum()} />}
            <div className="overflow-x-auto">
                {images.length === 0 ? (
                    <p className="text-sm text-slate-600">{ui("Album je prazan. Dodajte nove zapise.")}</p>
                ) : (
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Naslov")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Tip")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Velicina")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Ucitano")}</th>
                                <th className="px-4 py-2 text-right font-semibold text-slate-600">{ui("Radnje")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {images.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-2 font-medium text-slate-800">{item.title}</td>
                                    <td className="px-4 py-2 text-slate-600">{ui(item.mediaType)}</td>
                                    <td className="px-4 py-2 text-slate-600">{formatSize(item.size)}</td>
                                    <td className="px-4 py-2 text-slate-600">{new Date(item.uploadedAt).toLocaleString(locale)}</td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            <PortalMedia id={item.id} title={item.title} mediaType={item.mediaType} />
                                            {item.canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/portal/gallery/items/${item.id}/edit`)}
                                                    className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                                >
                                                    {ui("Uredi")} </button>
                                            )}
                                            {item.canDelete && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDelete(item)}
                                                    className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700"
                                                >
                                                    {ui("Obrisi")} </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
