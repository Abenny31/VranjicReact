import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { approveUser, deleteUser, fetchUsersPage, resendInvitation, type UserListOptions } from '@/lib/account-api';
import { useEditorialList } from '@/hooks/useEditorialList';
import ListPagination from '@/components/common/ListPagination';

export default function PortalUsersList() {
    const { ui } = useUiTranslation();
    const { getAccessToken, hasRole, user: authUser } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [role, setRole] = useState('');
    const [saving, setSaving] = useState(false);
    const loadPage = useCallback((options: UserListOptions) => fetchUsersPage({ ...options, search, role,
        emailConfirmed: status === 'all' ? undefined : status === 'approved' }), [search, role, status]);
    const { items: users, loading, error, page, setPage, hasMore, refresh, refreshAfterDelete } = useEditorialList(loadPage);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(() => {
        const message = (location.state as { successMessage?: unknown } | null)?.successMessage;
        return typeof message === 'string' ? message : null;
    });

    const handleResend = async (id: string) => {
        setSaving(true); setActionError(null); setActionMessage(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            const result = await resendInvitation(id, token);
            if (result.emailSent) setActionMessage(result.message);
            else setActionError(result.message);
        } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Pozivnica nije poslana.'); }
        finally { setSaving(false); }
    };

    const isSuperUser = hasRole('SuperUser');
    const canDeleteUsers = isSuperUser || hasRole('Administrator');

    const roleLabels = useMemo<Record<string, string>>(
        () => ({
            SuperUser: t('portal.userForm.role.superUser', 'SuperUser (1)'),
            Administrator: t('portal.userForm.role.administrator', 'Administrator (2)'),
            Moderator: t('portal.userForm.role.moderator', 'Moderator (3)'),
            Korisnik: t('portal.userForm.role.korisnik', 'Korisnik (4)'),
            Gost: t('portal.userForm.role.guest', 'Gost (5)'),
            Provjeravatelj: t('portal.userForm.role.verifier', 'Provjeravatelj'),
        }),
        [t]
    );

    const canApprove = isSuperUser;

    const handleApprove = async (id: string) => {
        setActionError(null);
        setSaving(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                setActionError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await approveUser(id, token);
            if (status === 'pending') refreshAfterDelete();
            else refresh();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Akcija nije uspjela.';
            setActionError(message);
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string, email: string) => {
        if (!canDeleteUsers) {
            return;
        }

        if (authUser?.id === id) {
            setActionError('Ne mozete obrisati vlastiti korisnicki racun.');
            return;
        }

        const confirmed = window
            .confirm(t('portal.users.confirmDelete', 'Zelite li obrisati korisnika {email}?').replace('{email}', email));

        if (!confirmed) {
            return;
        }

        setActionError(null);
        setSaving(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                setActionError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await deleteUser(id, token);
            refreshAfterDelete();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Akcija nije uspjela.';
            setActionError(message);
        } finally { setSaving(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-800">
                    {t('portal.users.title', 'Korisnici')}
                </h2>
                <button
                    type="button"
                    onClick={() => navigate('new')}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                    {t('portal.users.create', 'Novi korisnik')}
                </button>
            </div>

            <form onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }} className="flex flex-wrap items-end gap-3">
                <label className="text-sm">{ui("Pretraga korisnika")} <input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={200} disabled={saving} className="ml-2 rounded border p-2" placeholder={ui("Email, korisničko ime ili nadimak")} />
                </label>
                <button disabled={saving} className="rounded border px-3 py-2 text-sm">{ui("Pretraži")}</button>
                <label className="text-sm">{ui("Status korisnika")} <select value={status} disabled={saving} onChange={event => { setStatus(event.target.value); setPage(1); }} className="ml-2 rounded border p-2">
                        <option value="all">{ui("Svi")}</option><option value="pending">{ui("Čeka odobrenje")}</option><option value="approved">{ui("Odobren")}</option>
                    </select>
                </label>
                <label className="text-sm">{ui("Uloga")} <select value={role} disabled={saving} onChange={event => { setRole(event.target.value); setPage(1); }} className="ml-2 rounded border p-2">
                        <option value="">{ui("Sve uloge")}</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </label>
            </form>
            {error && <div role="alert" className="text-sm text-red-600">{ui(error)} <button type="button" onClick={refresh}>{ui("Pokušaj ponovno")}</button></div>}
            {actionError && <p className="text-sm text-red-600">{ui(actionError)}</p>}
            {actionMessage && <p role="status" className="text-sm text-green-700">{ui(actionMessage)}</p>}
            {loading && <p role="status" className="text-sm text-slate-500">{t('common.loading', 'Učitavanje...')}</p>}
            {!loading && !error && (users.length === 0 ? (
                <p className="text-sm text-slate-600">
                    {t('portal.users.empty', 'Nema registriranih korisnika.')}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">{ui('Nadimak')}</th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('portal.users.email', 'Email')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('portal.users.status', 'Status')}
                                </th>
                                {isSuperUser && (
                                    <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                        {t('portal.users.roles', 'Uloge')}
                                    </th>
                                )}
                                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                                    {t('portal.users.actions', 'Radnje')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(user => {
                                const showApprove = canApprove && !user.emailConfirmed && !user.invitationPending;
                                const showEdit = isSuperUser;
                                const showDelete = canDeleteUsers && !user.isProtected && authUser?.id !== user.id && (isSuperUser || !user.roles.includes('SuperUser'));
                                const hasActions = showApprove || showEdit || showDelete;

                                return (
                                    <tr key={user.id}>
                                        <td className="px-4 py-2 text-slate-800">{user.nickname || '—'}</td>
                                        <td className="px-4 py-2 font-medium text-slate-800">{user.email}
                                            {user.isProtected && <span className="block text-xs text-slate-500">{ui('Zaštićeni početni račun')}</span>}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">
                                            {user.invitationPending ? ui('Čeka prihvaćanje pozivnice') : user.emailConfirmed
                                                ? t('portal.users.status.active', 'Odobren')
                                                : t('portal.users.status.pending', 'Ceka odobrenje')}
                                        </td>
                                        {isSuperUser && (
                                            <td className="px-4 py-2 text-slate-600">
                                                {user.roles.length === 0
                                                    ? t('portal.users.role.none', 'Bez uloge')
                                                    : user.roles.map(role => roleLabels[role] ?? role).join(', ')}
                                            </td>
                                        )}
                                        <td className="px-4 py-2">
                                            <div className="flex justify-end gap-2">
                                                {isSuperUser && user.invitationPending && <button type="button" disabled={saving} onClick={() => void handleResend(user.id)} className="rounded border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">{ui('Ponovno pošalji pozivnicu')}</button>}
                                                {showApprove && (
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() => void handleApprove(user.id)}
                                                        className="rounded border border-green-200 px-3 py-1 text-xs font-semibold text-green-700 transition hover:border-green-300 hover:text-green-800"
                                                    >
                                                        {t('portal.users.approve', 'Odobri')}
                                                    </button>
                                                )}
                                                {showEdit && (
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() => navigate(`${user.id}/edit`)}
                                                        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                                    >
                                                        {t('portal.users.edit', 'Uredi')}
                                                    </button>
                                                )}
                                                {showDelete && (
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() => void handleDelete(user.id, user.email)}
                                                        className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700"
                                                    >
                                                        {t('portal.users.delete', 'Obrisi')}
                                                    </button>
                                                )}
                                                {!hasActions && <span className="text-xs text-slate-400">-</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}
            <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} disabled={loading || saving || !!error} />
        </div>
    );
}
