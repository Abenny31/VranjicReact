import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEditorialList } from '@/hooks/useEditorialList';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { deleteBlogPost, fetchBlogPostsPage } from '@/lib/blog-api';
import {
    CONTENT_CREATE_ROLES,
    CONTENT_MANAGE_ROLES,
    CONTENT_VERIFY_ROLES,
    hasAnyRole,
} from '@/lib/auth-roles';
import { editorialStatusLabels, originLabels } from '@/lib/content-labels';
import { archiveContent, publishApproved, submitForReview } from '@/lib/moderation-api';
import type { BlogPostSummary } from '@/lib/types';

export default function PortalBlogList() {
    const { ui } = useUiTranslation();
    const { getAccessToken, hasRole } = useAuth();
    const { items, page, setPage, hasMore, loading, error, setError, refresh, refreshAfterDelete } = useEditorialList(fetchBlogPostsPage);
    const navigate = useNavigate();
    const [processingId, setProcessingId] = useState<number | null>(null);
    const canCreate = hasAnyRole(hasRole, CONTENT_CREATE_ROLES);
    const canManage = hasAnyRole(hasRole, CONTENT_MANAGE_ROLES);
    const canVerify = hasAnyRole(hasRole, CONTENT_VERIFY_ROLES);

    const load = refresh;



    const handleDelete = async (id: number) => {
        if (!canManage || !window.confirm(ui("Želite li obrisati ovu priču?"))) return;
        setProcessingId(id);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            await deleteBlogPost(id, token);
            refreshAfterDelete();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Brisanje nije uspjelo.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleWorkflow = async (item: BlogPostSummary, action: 'submit' | 'publish' | 'archive') => {
        if (action === 'archive' && !window.confirm(ui("Arhivirati ovu priču i ukloniti je iz javne objave?"))) return;
        if (action === 'publish' && item.editorialStatus !== 'Approved' && !window.confirm(ui("Izravna objava bez pregleda bit će zabilježena u povijesti. Nastaviti?"))) return;
        setProcessingId(item.id);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            if (action === 'submit') await submitForReview('Blog', item.id, item.rowVersion, token);
            else if (action === 'publish') await publishApproved('Blog', item.id, item.rowVersion, token);
            else await archiveContent('Blog', item.id, item.rowVersion, token);
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Promjena statusa nije uspjela.');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <p className="text-sm text-slate-500">{ui("Učitavanje...")}</p>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-800">{ui("Priče")}</h2>
                {canCreate && (
                    <button type="button" onClick={() => navigate('new')} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                        {ui("Nova priča")} </button>
                )}
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{ui(error)} <button type="button" onClick={refresh} className="underline">{ui("Pokušaj ponovno")}</button></p>}
            {canCreate && <p className="text-sm text-slate-600">{ui('Spremanje čuva nacrt. Moderator ga dobiva tek kada odaberete „Pošalji na pregled”.')}</p>}

            {!error && (items.length === 0 ? (
                <p className="text-sm text-slate-600">{ui("Nema spremljenih priča.")}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Naslov")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Područje")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Status")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Podrijetlo")}</th>
                                <th className="px-4 py-2 text-right font-semibold text-slate-600">{ui("Radnje")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-2 font-medium text-slate-800">
                                        {item.publishedAt && new Date(item.publishedAt) <= new Date() ? (
                                            <Link to={`/blog/${item.slug}`} target="_blank" rel="noreferrer" className="hover:underline">{item.title}</Link>
                                        ) : item.title}
                                        {item.latestModerationComment && <p className="mt-1 text-xs font-normal text-amber-700">{item.latestModerationComment}</p>}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">{item.area?.name ?? '—'}</td>
                                    <td className="px-4 py-2 text-slate-600">{ui(editorialStatusLabels[item.editorialStatus ?? (item.publishedAt ? 'Published' : 'Draft')])}</td>
                                    <td className="px-4 py-2 text-slate-600">{item.origin ? ui(originLabels[item.origin]) : ui("Nije određeno")}</td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            {canVerify && <Link to={`/portal/blog/${item.id}/review`} className="rounded border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700">{ui('Pregledaj i provjeri')}</Link>}
                                            {item.canEdit && (
                                                    <button type="button" onClick={() => navigate(`${item.id}/edit`)} className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700">{ui("Uredi")}</button>
                                            )}
                                            {item.canSubmit && (
                                                <button type="button" disabled={processingId === item.id} onClick={() => void handleWorkflow(item, 'submit')} className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 disabled:opacity-50">{ui("Pošalji na pregled")}</button>
                                            )}
                                            {canManage && item.editorialStatus !== 'Published' && (
                                                <button type="button" disabled={processingId === item.id} onClick={() => void handleWorkflow(item, 'publish')} className="rounded border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50">{ui("Objavi")}</button>
                                            )}
                                            {canManage && item.editorialStatus !== 'Archived' && (
                                                <button type="button" disabled={processingId === item.id} onClick={() => void handleWorkflow(item, 'archive')} className="rounded border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 disabled:opacity-50">{ui("Arhiviraj")}</button>
                                            )}
                                            {canManage && (
                                                    <button type="button" disabled={processingId === item.id} onClick={() => void handleDelete(item.id)} className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50">{ui("Obriši")}</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
            {!error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} disabled={processingId !== null} />}
        </div>
    );
}
