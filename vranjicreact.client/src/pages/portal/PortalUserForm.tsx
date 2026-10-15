import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createUser, fetchInvitationAvailability, inviteUser, type InvitationResult } from '@/lib/account-api';
import PasswordField from '@/components/common/PasswordField';

export default function PortalUserForm() {
    const { ui } = useUiTranslation();
    const { getAccessToken, hasRole } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmEmail, setConfirmEmail] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invitationsEnabled, setInvitationsEnabled] = useState(false);
    const [sendInvitation, setSendInvitation] = useState(false);
    const [invitationResult, setInvitationResult] = useState<InvitationResult | null>(null);

    const isSuperUser = hasRole('SuperUser');
    useEffect(() => {
        if (!isSuperUser) return;
        let cancelled = false;
        void getAccessToken().then(async token => {
            if (!token) return;
            const availability = await fetchInvitationAvailability(token);
            if (!cancelled) setInvitationsEnabled(availability.enabled);
        }).catch(() => { if (!cancelled) setError('Dostupnost pozivnica nije moguće provjeriti. Ručno kreiranje računa je dostupno.'); });
        return () => { cancelled = true; };
    }, [getAccessToken, isSuperUser]);
    const roleOptions = useMemo(
        () => [
            { value: 'SuperUser', label: t('portal.userForm.role.superUser', 'SuperUser (1)'), restricted: true },
            { value: 'Administrator', label: t('portal.userForm.role.administrator', 'Administrator (2)') },
            { value: 'Moderator', label: t('portal.userForm.role.moderator', 'Moderator (3)') },
            { value: 'Korisnik', label: t('portal.userForm.role.korisnik', 'Korisnik (4)') },
            { value: 'Gost', label: t('portal.userForm.role.guest', 'Gost (5)') },
            { value: 'Provjeravatelj', label: t('portal.userForm.role.verifier', 'Provjeravatelj') },
        ],
        [t]
    );

    const toggleRole = (role: string) => {
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(item => item !== role) : [...prev, role]
        );
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!email.trim() || (!sendInvitation && !password)) {
            setError('Email i lozinka su obavezni.');
            return;
        }

        if (!sendInvitation && password !== confirmPassword) {
            setError('Lozinke se ne podudaraju.');
            return;
        }

        setSubmitting(true);

        try {
            const token = await getAccessToken();
            if (!token) {
                setError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            if (sendInvitation) {
                if (selectedRoles.length === 0) {
                    setError('Odaberite barem jednu valjanu ulogu.');
                    return;
                }
                const result = await inviteUser({ email: email.trim(), roles: selectedRoles, ...(nickname.trim() ? { nickname: nickname.trim() } : {}) }, token);
                if (result.emailSent) navigate('/portal/users', { replace: true, state: { successMessage: result.message } });
                else setInvitationResult(result);
                return;
            }

            await createUser(
                {
                    email: email.trim(),
                    password,
                    ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
                    confirmEmail,
                    roles: selectedRoles,
                },
                token
            );

            navigate('/portal/users', { replace: true, state: { successMessage: 'Korisnik je uspješno dodan.' } });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Akcija nije uspjela.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (invitationResult) return <div className="space-y-4">
        <p role="status" className={invitationResult.emailSent ? 'text-green-700' : 'text-amber-700'}>{ui(invitationResult.message)}</p>
        <button type="button" onClick={() => navigate('/portal/users')} className="rounded border px-4 py-2">{ui('Povratak na korisnike')}</button>
    </div>;

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                    {t('portal.userForm.title', 'Novi korisnik')}
                </h2>
                <button
                    type="button"
                    onClick={() => navigate('/portal/users')}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {t('portal.userForm.back', 'Nazad')}
                </button>
            </div>

            {error && <p className="text-sm text-red-600">{ui(error)}</p>}
            {isSuperUser && invitationsEnabled && <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sendInvitation} disabled={submitting} onChange={event => setSendInvitation(event.target.checked)} />
                {ui('Pošalji pozivnicu e-mailom — korisnik sam postavlja lozinku')}
            </label>}

            <div className="flex flex-col text-sm">
                <label htmlFor="user-nickname" className="font-semibold text-slate-600">{ui('Nadimak')}</label>
                <input id="user-nickname" aria-describedby="user-nickname-help" value={nickname} onChange={event => setNickname(event.target.value)} maxLength={60} autoComplete="nickname"
                    className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none" />
                <span id="user-nickname-help" className="mt-1 text-xs text-slate-500">{ui('Neobavezno ime za prepoznavanje korisnika. Prijava i dalje koristi email.')}</span>
            </div>

            <label className="flex flex-col text-sm">
                <span className="font-semibold text-slate-600">{t('portal.userForm.email', 'Email *')}</span>
                <input
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    required
                    className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            {!sendInvitation && <>
            <PasswordField label={t('portal.userForm.password', 'Lozinka *')} value={password}
                onChange={event => setPassword(event.target.value)} required autoComplete="new-password" />
            <PasswordField label={t('portal.userForm.passwordConfirm', 'Potvrda lozinke *')} value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)} required autoComplete="new-password" />

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={confirmEmail}
                    disabled={!isSuperUser}
                    onChange={event => setConfirmEmail(event.target.checked)}
                    className="h-4 w-4"
                />
                <span className="font-semibold text-slate-600">
                    {t(
                        'portal.userForm.confirmEmail',
                        'Označi email kao potvrđen (odobrenje nije potrebno)'
                    )}
                </span>
            </label>

            </>}

            <div className="space-y-2 rounded border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-600">
                    {t(
                        'portal.userForm.assignRoles',
                        'Dodijeli uloge'
                    )}
                </p>
                <p className="text-xs text-slate-500">
                    {t(
                        'portal.userForm.role.helper',
                        'Odaberite jednu ili više uloga za novi račun. SuperUser ima sva prava.'
                    )}
                </p>
                <div className="space-y-1">
                    {!isSuperUser && <p className="text-sm text-amber-700">{ui("Račun i role potvrđuje SuperUser. Slanje emaila nije omogućeno.")}</p>}
                    {roleOptions.map(option => (
                        <label key={option.value} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={selectedRoles.includes(option.value)}
                                onChange={() => toggleRole(option.value)}
                                disabled={!isSuperUser}
                                className="h-4 w-4"
                            />
                            <span
                                className={`font-semibold ${
                                    !isSuperUser ? 'text-slate-400' : 'text-slate-600'
                                }`}
                            >
                                {option.label}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
                {submitting
                    ? t('portal.userForm.saving', 'Spremanje...')
                    : sendInvitation ? ui('Pošalji pozivnicu') : t('portal.userForm.save', 'Spremi korisnika')}
            </button>
        </form>
    );
}
