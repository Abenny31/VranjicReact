import PasswordField from '@/components/common/PasswordField';
import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { acceptInvitation } from '@/lib/account-api';
import { useUiTranslation } from '@/hooks/useUiTranslation';

export default function AcceptInvitation() {
    const { ui } = useUiTranslation();
    const { hash } = useLocation();
    const parameters = new URLSearchParams(hash.slice(1));
    const userId = parameters.get('userId');
    const token = parameters.get('token');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [saving, setSaving] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !userId || !token) return;
        setError(null);
        if (password !== confirmation) { setError('Lozinke se ne podudaraju.'); return; }
        setSaving(true);
        try {
            await acceptInvitation({ userId, token, password });
            setAccepted(true); setPassword(''); setConfirmation('');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Pozivnicu nije moguće prihvatiti.'); }
        finally { setSaving(false); }
    }

    return <div className="mx-auto max-w-md space-y-4 py-10">
        <h1 className="text-2xl font-semibold">{ui('Postavite prvu lozinku')}</h1>
        {accepted ? <>
            <p role="status">{ui('Račun je aktiviran. Prijavite se svojim e-mailom i novom lozinkom.')}</p>
            <Link to="/login" replace className="text-blue-600 underline">{ui('Prijavi se')}</Link>
        </> : !userId || !token ? <p role="alert">{ui('Pozivnica nije valjana ili je istekla. Zatražite novu pozivnicu.')}</p> :
            <form onSubmit={submit} className="space-y-4">
                {error && <p role="alert" className="text-red-600">{ui(error)}</p>}
                <PasswordField label={ui('Nova lozinka')} autoComplete="new-password" required minLength={6} maxLength={256} disabled={saving} value={password} onChange={event => setPassword(event.target.value)} />
                <p className="text-xs text-slate-500">{ui('Lozinka mora imati barem 6 znakova, malo slovo i znamenku.')}</p>
                <PasswordField label={ui('Potvrda nove lozinke')} autoComplete="new-password" required maxLength={256} disabled={saving} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
                <button disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-blue-300">{ui(saving ? 'Spremanje...' : 'Aktiviraj račun')}</button>
            </form>}
    </div>;
}
