import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchUser, updateUser } from '@/lib/account-api';

export default function PortalUserEditForm() {
    const { ui } = useUiTranslation();
    const { id } = useParams<{ id: string }>();
    const { getAccessToken, hasRole } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [nickname, setNickname] = useState('');
    const [emailConfirmed, setEmailConfirmed] = useState(false);
    const [isProtected, setIsProtected] = useState(false);
    const [invitationPending, setInvitationPending] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isSuperUser = hasRole('SuperUser');
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

    useEffect(() => {
        const load = async () => {
            if (!id) {
                setError('Neuspjesno ucitavanje korisnika.');
                setLoading(false);
                return;
            }

            try {
                const token = await getAccessToken();
                if (!token) {
                    setError('Sesija je istekla. Prijavite se ponovno.');
                    setLoading(false);
                    return;
                }

                const user = await fetchUser(id, token);
                setEmail(user.email);
                setNickname(user.nickname ?? '');
                setEmailConfirmed(user.emailConfirmed);
                setIsProtected(user.isProtected ?? false);
                setInvitationPending(user.invitationPending ?? false);
                setSelectedRoles(user.roles);
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Neuspjesno ucitavanje korisnika.';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [getAccessToken, id]);

    const toggleRole = (role: string) => {
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(item => item !== role) : [...prev, role]
        );
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!id) {
            return;
        }

        if (!email.trim()) {
            setError('Email je obavezan.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const token = await getAccessToken();
            if (!token) {
                setError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await updateUser(
                id,
                {
                    email: email.trim(),
                    emailConfirmed,
                    nickname: nickname.trim(),
                    roles: selectedRoles,
                },
                token
            );

            navigate('/portal/users');
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Akcija nije uspjela.';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-sm text-slate-500">{t('common.loading', 'Ucitavanje...')}</p>;
    }

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                    {t('portal.userForm.titleEdit', 'Uredi korisnika')}
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
            {isProtected && <p className="text-sm text-slate-600">{ui('Početni račun je zaštićen od brisanja, deaktivacije i uklanjanja SuperUser uloge.')}</p>}
            {invitationPending && <p className="text-sm text-slate-600">{ui('E-mail pozvanog korisnika potvrđuje se prihvaćanjem pozivnice. Nakon promjene adrese pošaljite novu pozivnicu.')}</p>}

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

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={emailConfirmed}
                    disabled={isProtected || invitationPending}
                    onChange={event => setEmailConfirmed(event.target.checked)}
                    className="h-4 w-4"
                />
                <span className="font-semibold text-slate-600">
                    {t('portal.userForm.confirmEmail', 'Oznaci email kao potvrden (odobrenje nije potrebno)')}
                </span>
            </label>

            <div className="space-y-2 rounded border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-600">
                    {t('portal.userForm.assignRoles', 'Dodijeli uloge')}
                </p>
                <p className="text-xs text-slate-500">
                    {t(
                        'portal.userForm.role.helper',
                        'Odaberite jednu ili vise uloga za novi racun. SuperUser ima sva prava.'
                    )}
                </p>
                <div className="space-y-1">
                    {roleOptions.map(option => (
                        <label key={option.value} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={selectedRoles.includes(option.value)}
                                onChange={() => toggleRole(option.value)}
                                disabled={(option.restricted && !isSuperUser) || (isProtected && option.value === 'SuperUser')}
                                className="h-4 w-4"
                            />
                            <span
                                className={`font-semibold ${
                                    option.restricted && !isSuperUser ? 'text-slate-400' : 'text-slate-600'
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
                disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
                {saving
                    ? t('portal.userForm.saving', 'Spremanje...')
                    : t('portal.userForm.save', 'Spremi korisnika')}
            </button>
        </form>
    );
}
