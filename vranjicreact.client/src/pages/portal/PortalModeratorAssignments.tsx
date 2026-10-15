import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUsersPage, type UserListOptions } from '@/lib/account-api';
import { useEditorialList } from '@/hooks/useEditorialList';
import ListPagination from '@/components/common/ListPagination';
import { fetchAreas } from '@/lib/classification-api';
import {
    deactivateModeratorAssignment,
    fetchModeratorAssignmentsPage,
    saveModeratorAssignment,
    type AssignmentListOptions,
} from '@/lib/moderation-api';
import type { Area, UserListItem } from '@/lib/types';

export default function PortalModeratorAssignments() {
    const { ui, locale } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const [assignmentSearchInput, setAssignmentSearchInput] = useState('');
    const [assignmentSearch, setAssignmentSearch] = useState('');
    const [assignmentStatus, setAssignmentStatus] = useState<NonNullable<AssignmentListOptions['status']>>('all');
    const [assignmentArea, setAssignmentArea] = useState('');
    const loadAssignments = useCallback((options: AssignmentListOptions) => fetchModeratorAssignmentsPage({ ...options,
        search: assignmentSearch, status: assignmentStatus, areaId: assignmentArea ? Number(assignmentArea) : undefined }), [assignmentSearch, assignmentStatus, assignmentArea]);
    const assignmentList = useEditorialList(loadAssignments);
    const [areas, setAreas] = useState<Area[]>([]);
    const [selectedModerator, setSelectedModerator] = useState<UserListItem | null>(null);
    const userId = selectedModerator?.id ?? '';
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const loadModerators = useCallback((options: UserListOptions) => fetchUsersPage({ ...options, search, role: 'Moderator' }), [search]);
    const moderatorList = useEditorialList(loadModerators);
    const [areaId, setAreaId] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        fetchAreas()
            .then(result => { if (active) setAreas(result.filter(area => area.isActive)); })
            .catch(reason => {
                if (active) setError(reason instanceof Error ? reason.message : 'Dodjele se ne mogu učitati.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!userId || !areaId) return;
        setSaving(true);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            await saveModeratorAssignment({
                userId,
                areaId: Number.parseInt(areaId, 10),
                endsAt: endsAt ? new Date(endsAt).toISOString() : null,
            }, token);
            assignmentList.refresh();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Dodjela nije spremljena.');
        } finally {
            setSaving(false);
        }
    };

    const deactivate = async (id: number) => {
        setSaving(true);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            await deactivateModeratorAssignment(id, token);
            if (assignmentStatus === 'active' || assignmentStatus === 'expired') assignmentList.refreshAfterDelete();
            else assignmentList.refresh();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Dodjela nije deaktivirana.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-sm text-slate-500">{ui("Učitavanje...")}</p>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-slate-800">{ui("Dodjele moderatora")}</h2>
                <p className="mt-1 text-sm text-slate-500">{ui("Korisnik prvo mora imati ulogu Moderator.")}</p>
            </div>
            {error && <p className="text-sm text-red-600">{ui(error)}</p>}
            <form onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); moderatorList.setPage(1); }} className="flex flex-wrap items-end gap-3">
                <label className="text-sm">{ui("Pretraga moderatora")} <input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={200} disabled={saving} className="ml-2 rounded border p-2" placeholder={ui("Email ili korisničko ime")} />
                </label>
                <button disabled={saving} className="rounded border px-3 py-2 text-sm">{ui("Pretraži")}</button>
            </form>
            {moderatorList.loading && <p role="status">{ui("Učitavanje moderatora...")}</p>}
            {moderatorList.error && <div role="alert" className="text-sm text-red-600">{ui(moderatorList.error)} <button type="button" onClick={moderatorList.refresh}>{ui("Pokušaj ponovno")}</button></div>}
            {!moderatorList.loading && !moderatorList.error && moderatorList.items.length === 0 && <p>{ui("Nema moderatora za zadanu pretragu.")}</p>}
            <div aria-label={ui("Straničenje moderatora")}><ListPagination page={moderatorList.page} hasMore={moderatorList.hasMore} onPageChange={moderatorList.setPage} disabled={saving || moderatorList.loading || !!moderatorList.error} /></div>
            <form onSubmit={submit} className="grid gap-3 rounded border border-slate-200 p-4 md:grid-cols-4">
                <select required aria-label={ui("Moderator")} disabled={saving || moderatorList.loading || !!moderatorList.error} value={userId} onChange={event => setSelectedModerator(moderatorList.items.find(user => user.id === event.target.value) ?? null)} className="rounded border border-slate-300 p-2 text-sm">
                    <option value="">{ui("Odaberite moderatora")}</option>
                    {selectedModerator && (moderatorList.loading || !!moderatorList.error || !moderatorList.items.some(user => user.id === selectedModerator.id)) && <option value={selectedModerator.id}>{selectedModerator.email}  {ui("(odabran)")}</option>}
                    {!moderatorList.loading && !moderatorList.error && moderatorList.items.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}
                </select>
                <select required aria-label={ui("Područje")} disabled={saving} value={areaId} onChange={event => setAreaId(event.target.value)} className="rounded border border-slate-300 p-2 text-sm">
                    <option value="">{ui("Odaberite područje")}</option>
                    {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select>
                <input type="datetime-local" disabled={saving} value={endsAt} onChange={event => setEndsAt(event.target.value)} className="rounded border border-slate-300 p-2 text-sm" aria-label={ui("Vrijedi do")} />
                <button disabled={saving || !userId || !areaId || moderatorList.loading || !!moderatorList.error} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{ui("Spremi dodjelu")}</button>
            </form>
            <form onSubmit={event => { event.preventDefault(); setAssignmentSearch(assignmentSearchInput.trim()); assignmentList.setPage(1); }} className="flex flex-wrap gap-3">
                <label>{ui("Pretraga dodjela")} <input value={assignmentSearchInput} onChange={event => setAssignmentSearchInput(event.target.value)} maxLength={200} disabled={saving} className="rounded border p-2" /></label>
                <button disabled={saving} className="rounded border px-3 py-2">{ui("Pretraži dodjele")}</button>
                <label>{ui("Status dodjele")} <select value={assignmentStatus} disabled={saving} onChange={event => { setAssignmentStatus(event.target.value as NonNullable<AssignmentListOptions['status']>); assignmentList.setPage(1); }} className="rounded border p-2">
                    <option value="all">{ui("Sve")}</option><option value="active">{ui("Aktivne")}</option><option value="expired">{ui("Istekle")}</option><option value="inactive">{ui("Neaktivne")}</option>
                </select></label>
                <label>{ui("Područje dodjele")} <select value={assignmentArea} disabled={saving} onChange={event => { setAssignmentArea(event.target.value); assignmentList.setPage(1); }} className="rounded border p-2">
                    <option value="">{ui("Sva područja")}</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                </select></label>
            </form>
            {assignmentList.loading && <p role="status">{ui("Učitavanje dodjela...")}</p>}
            {assignmentList.error && <div role="alert" className="text-red-600">{ui(assignmentList.error)} <button type="button" onClick={assignmentList.refresh}>{ui("Pokušaj ponovno")}</button></div>}
            {!assignmentList.loading && !assignmentList.error && !assignmentList.items.length && <p>{ui("Nema dodjela za zadane filtre.")}</p>}
            {!assignmentList.loading && !assignmentList.error && <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50"><tr><th className="px-4 py-2 text-left">{ui("Moderator")}</th><th className="px-4 py-2 text-left">{ui("Područje")}</th><th className="px-4 py-2 text-left">{ui("Vrijedi do")}</th><th className="px-4 py-2 text-right">{ui("Status")}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {assignmentList.items.map(assignment => (
                            <tr key={assignment.id}>
                                <td className="px-4 py-2">{assignment.userEmail}</td>
                                <td className="px-4 py-2">{assignment.area.name}</td>
                                <td className="px-4 py-2">{assignment.endsAt ? new Date(assignment.endsAt).toLocaleString(locale) : ui("Bez isteka")}</td>
                                <td className="px-4 py-2 text-right">
                                    <span className="mr-2">{assignment.status === 'Expired' ? ui("Isteklo") : assignment.isActive ? ui("Aktivno") : ui("Neaktivno")}</span>
                                    {assignment.isActive && <button disabled={saving} onClick={() => void deactivate(assignment.id)} className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50">{ui("Deaktiviraj")}</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>}
            <div aria-label={ui("Straničenje dodjela")}><ListPagination page={assignmentList.page} hasMore={assignmentList.hasMore} onPageChange={assignmentList.setPage} disabled={saving || assignmentList.loading || !!assignmentList.error} /></div>
        </div>
    );
}
