import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEditorialList } from '@/hooks/useEditorialList';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CONTENT_CREATE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import PortalMedia from '@/components/common/PortalMedia';
import EditorialPanel from '@/components/common/EditorialPanel';
import { fetchGalleryAlbumsPage } from '@/lib/gallery-api';

export default function PortalGalleryList() {
    const { ui } = useUiTranslation();
    const { items: albums, page, setPage, hasMore, loading, error, refresh } = useEditorialList(fetchGalleryAlbumsPage);
    const navigate = useNavigate();
    const { hasRole } = useAuth();
    const { t } = useLanguage();

    const canCreateMedia = useMemo(() => hasAnyRole(hasRole, CONTENT_CREATE_ROLES), [hasRole]);



    if (loading) {
        return <p className="text-sm text-slate-500">{t('common.loading', 'Ucitavanje...')}</p>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-800">
                    {t('gallery.list.title', 'Albumi galerije')}
                </h2>
                <div className="flex flex-wrap gap-3">
                    {canCreateMedia && (
                        <button
                            type="button"
                            onClick={() => navigate('albums/new')}
                            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                        >
                            {t('gallery.list.createAlbum', 'Novi album')}
                        </button>
                    )}
                    {canCreateMedia && (
                        <button
                            type="button"
                            onClick={() => navigate('new')}
                            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            {t('gallery.list.createItem', 'Dodaj zapis')}
                        </button>
                    )}
                </div>
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{ui(error)} <button type="button" onClick={refresh} className="underline">{ui("Pokušaj ponovno")}</button></p>}

            {!error && (albums.length === 0 ? (
                <p className="text-sm text-slate-600">
                    {t(
                        'gallery.list.empty',
                        'Jos nema albuma. Zapocnite stvaranjem prvog albuma kako biste mogli dodavati fotografije i video zapise.'
                    )}
                </p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {albums.map(album => {
                        const countLabel =
                            album.imageCount === 1
                                ? t('gallery.list.itemCount.single', '1 zapis')
                                : t('gallery.list.itemCount.multiple', '{count} zapisa').replace(
                                      '{count}',
                                      album.imageCount.toString()
                                  );

                        return (
                            <div
                                key={album.id}
                                className="flex h-full flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-sm"
                            >
                                <div
                                    className="relative w-full overflow-hidden bg-slate-100"
                                    style={{ paddingBottom: '56%' }}
                                >
                                    {album.coverImage ? (
                                        <div className="absolute inset-0"><PortalMedia id={album.coverImage.id} title={album.coverImage.title} mediaType={album.coverImage.mediaType} inline /></div>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                                            {t('gallery.list.noCover', 'Bez naslovne fotografije')}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-1 flex-col gap-2 p-4 text-sm text-slate-600">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">{album.title}</h3>
                                        {album.description && (
                                            <p className="mt-1 text-slate-600">{album.description}</p>
                                        )}
                                    </div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">{countLabel}</p>
                                    {album.relatedNewsId && album.relatedNewsSlug && (
                                        <p className="text-xs text-slate-500">
                                            {t('gallery.list.relatedNews', 'Povezano s novosti ')}
                                            <Link
                                                to={`/portal/news/${album.relatedNewsId}/edit`}
                                                className="font-semibold text-blue-600 underline underline-offset-4"
                                            >
                                                {album.relatedNewsTitle ?? album.relatedNewsSlug}
                                            </Link>
                                        </p>
                                    )}
                                    <div className="mt-auto flex flex-wrap gap-2">
                                        {album.canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => navigate(`albums/${album.id}/edit`)}
                                                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                            >
                                                {ui("Uredi album")} </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => navigate(`${album.id}`)}
                                            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                        >
                                            {t('gallery.list.openAlbum', 'Otvori album')}
                                        </button>
                                        {canCreateMedia && album.canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => navigate(`new?albumId=${album.id}`)}
                                                className="rounded border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:border-blue-300 hover:text-blue-700"
                                            >
                                                {t('gallery.list.createItem', 'Dodaj zapis')}
                                            </button>
                                        )}
                                    </div>
                                    <EditorialPanel type="Gallery" id={album.id} status={album.editorialStatus} rowVersion={album.rowVersion} canSubmit={album.canSubmit} canViewHistory={album.canViewHistory} onChanged={refresh} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
            {!error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} />}
        </div>
    );
}
