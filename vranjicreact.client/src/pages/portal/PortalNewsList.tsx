import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEditorialList } from '@/hooks/useEditorialList';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CONTENT_CREATE_ROLES, CONTENT_MANAGE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import { deleteNews, fetchNewsPage } from '@/lib/news-api';
import { archiveContent, publishApproved, submitForReview } from '@/lib/moderation-api';
import type { NewsSummary } from '@/lib/types';
import { editorialStatusLabels } from '@/lib/content-labels';

export default function PortalNewsList() {
    const { ui } = useUiTranslation();
    const { getAccessToken, hasRole } = useAuth();
    const { t, language } = useLanguage();
    const { items, page, setPage, hasMore, loading, error, setError, refresh, refreshAfterDelete } = useEditorialList(fetchNewsPage);
    const navigate = useNavigate();
    const [processingId, setProcessingId] = useState<number | null>(null);

    const canManageContent = hasAnyRole(hasRole, CONTENT_MANAGE_ROLES);
    const canCreateContent = hasAnyRole(hasRole, CONTENT_CREATE_ROLES);
    const locale = language === 'en' ? 'en-US' : 'hr-HR';



    const handleDelete = async (id: number) => {
        if (!canManageContent) {
            return;
        }

        const confirmed = window.confirm(t('news.list.confirmDelete', 'Zelite li obrisati ovu novost?'));
        if (!confirmed) {
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                setError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await deleteNews(id, token);
            refreshAfterDelete();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Dogodila se greska.';
            setError(message);
        }
    };

    const handleWorkflow = async (item: NewsSummary, action: 'submit' | 'publish' | 'archive') => {
        if (action === 'archive' && !window.confirm(ui("Arhivirati ovu novost i ukloniti je iz javne objave?"))) return;
        if (action === 'publish' && item.editorialStatus !== 'Approved' && !window.confirm(ui("Izravna objava bez pregleda bit će zabilježena u povijesti. Nastaviti?"))) return;
        setProcessingId(item.id);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            if (action === 'submit') await submitForReview('News', item.id, item.rowVersion, token);
            else if (action === 'publish') await publishApproved('News', item.id, item.rowVersion, token);
            else await archiveContent('News', item.id, item.rowVersion, token);
            refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Dogodila se greska.');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return <p className="text-sm text-slate-500">{t('common.loading', 'Ucitavanje...')}</p>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">{t('news.list.title', 'Novosti')}</h2>
                {canCreateContent && (
                    <button
                        type="button"
                        onClick={() => navigate('new')}
                        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        {t('news.list.create', 'Nova objava')}
                    </button>
                )}
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{ui(error)} <button type="button" onClick={refresh} className="underline">{ui("Pokušaj ponovno")}</button></p>}

            {!error && (items.length === 0 ? (
                <p className="text-sm text-slate-600">
                    {t('news.list.empty', 'Trenutno nema objavljenih novosti.')}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('news.list.title', 'Naslov')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('news.list.publishedAt', 'Objavljeno')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('news.list.featured', 'Istaknuto')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Status")}</th>
                                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                                    {t('gallery.list.actions', 'Radnje')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map(item => {
                                const published = item.publishedAt
                                    ? new Date(item.publishedAt).toLocaleDateString(locale)
                                    : t('news.list.dateUnknown', 'Neobjavljeno');

                                return (
                                    <tr key={item.id}>
                                        <td className="px-4 py-2 font-medium text-slate-800">
                                            <Link
                                                to={`/novosti/${item.slug}`}
                                                className="hover:underline"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {item.title}
                                            </Link>
                                            {item.latestModerationComment && <p className="mt-1 text-xs font-normal text-amber-700">{item.latestModerationComment}</p>}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">{published}</td>
                                        <td className="px-4 py-2 text-slate-600">
                                            {item.isFeatured ? t('common.yes', 'Da') : t('common.no', 'Ne')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">{ui(editorialStatusLabels[item.editorialStatus ?? (item.publishedAt ? 'Published' : 'Draft')])}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex justify-end gap-2">
                                                {item.canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`${item.id}/edit`)}
                                                            className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                                        >
                                                            {t('news.list.edit', 'Uredi')}
                                                        </button>
                                                )}
                                                {item.canSubmit && (
                                                    <button type="button" disabled={processingId === item.id} onClick={() => void handleWorkflow(item, 'submit')} className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 disabled:opacity-50">
                                                        {ui("Pošalji na pregled")} </button>
                                                )}
                                                {canManageContent && item.editorialStatus !== 'Published' && (
                                                    <button type="button" disabled={processingId === item.id} onClick={() => void handleWorkflow(item, 'publish')} className="rounded border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50">
                                                        {ui("Objavi")} </button>
                                                )}
                                                {canManageContent && item.editorialStatus !== 'Archived' && (
                                                    <button type="button" disabled={processingId === item.id} onClick={() => void handleWorkflow(item, 'archive')} className="rounded border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 disabled:opacity-50">
                                                        {ui("Arhiviraj")} </button>
                                                )}
                                                {canManageContent && (
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleDelete(item.id)}
                                                            className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700"
                                                        >
                                                            {t('news.list.delete', 'Obrisi')}
                                                        </button>
                                                )}
                                                {!item.canEdit && !item.canSubmit && !canManageContent && <span className="text-xs text-slate-400">-</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}
            {!error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} disabled={processingId !== null} />}
        </div>
    );
}
