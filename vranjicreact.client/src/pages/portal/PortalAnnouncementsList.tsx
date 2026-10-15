import { useUiTranslation } from '@/hooks/useUiTranslation';
import ListPagination from '@/components/common/ListPagination';
import { useEditorialList } from '@/hooks/useEditorialList';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { deleteAnnouncement, fetchAnnouncementsPage } from '@/lib/announcements-api';
import { CONTENT_CREATE_ROLES, CONTENT_MANAGE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import EditorialPanel from '@/components/common/EditorialPanel';
import { editorialStatusLabels } from '@/lib/content-labels';

export default function PortalAnnouncementsList() {
    const { ui } = useUiTranslation();
    const { getAccessToken, hasRole } = useAuth();
    const { items, page, setPage, hasMore, loading, error, setError, refresh, refreshAfterDelete } = useEditorialList(fetchAnnouncementsPage);
    const navigate = useNavigate();
    const canCreate = hasAnyRole(hasRole, CONTENT_CREATE_ROLES);
    const canManage = hasAnyRole(hasRole, CONTENT_MANAGE_ROLES);



    const handleDelete = async (id: number) => {
        if (!canManage || !window.confirm(ui("Želite li obrisati ovu obavijest?"))) {
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('Sesija je istekla. Prijavite se ponovno.');
            }
            await deleteAnnouncement(id, token);
            refreshAfterDelete();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Brisanje nije uspjelo.');
        }
    };

    if (loading) {
        return <p className="text-sm text-slate-500">{ui("Učitavanje...")}</p>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-800">{ui("Obavijesti")}</h2>
                {canCreate && (
                    <button
                        type="button"
                        onClick={() => navigate('new')}
                        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        {ui("Nova obavijest")} </button>
                )}
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{ui(error)} <button type="button" onClick={refresh} className="underline">{ui("Pokušaj ponovno")}</button></p>}

            {!error && (items.length === 0 ? (
                <p className="text-sm text-slate-600">{ui("Nema spremljenih obavijesti.")}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Naslov")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Područje")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Status")}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui("Važnost")}</th>
                                <th className="px-4 py-2 text-right font-semibold text-slate-600">{ui("Radnje")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-2 font-medium text-slate-800">
                                        <Link to={`/obavijesti/${item.slug}`} target="_blank" rel="noreferrer" className="hover:underline">
                                            {item.title}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">{item.area?.name ?? '—'}</td>
                                    <td className="px-4 py-2 text-slate-600">
                                        {ui(editorialStatusLabels[item.editorialStatus ?? 'Draft'])}
                                        {item.editorialStatus === 'Published' && <p>{item.isExpired ? ui("Istekla") : item.isActive ? ui("Vidljiva javno") : ui("Zakazana")}</p>}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">
                                        {item.importance === 'Urgent' ? ui("Hitno") : item.importance === 'Important' ? ui("Važno") : ui("Normalno")}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            {item.canEdit ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`${item.id}/edit`)}
                                                        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                                                    >
                                                        {ui("Uredi")} </button>
                                                    <button
                                                        type="button"
                                                        disabled={!canManage}
                                                        onClick={() => void handleDelete(item.id)}
                                                        className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                                                    >
                                                        {ui("Obriši")} </button>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </div>
                                        <EditorialPanel type="Announcement" id={item.id} status={item.editorialStatus} rowVersion={item.rowVersion} canSubmit={item.canSubmit} onChanged={() => refresh()} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
            {!error && <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} disabled={false} />}
        </div>
    );
}
