import PasswordField from '@/components/common/PasswordField';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { changePassword } from '@/lib/account-api';

export default function PortalChangePassword() {
    const { ui } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const { t } = useLanguage();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setError('Nova lozinka i potvrda se ne podudaraju.');
            return;
        }

        setSubmitting(true);

        try {
            const token = await getAccessToken();
            if (!token) {
                setError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await changePassword(
                {
                    currentPassword,
                    newPassword,
                },
                token
            );

            setMessage('Lozinka je uspješno promijenjena.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Promjena lozinke nije uspjela.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <h2 className="text-xl font-semibold text-slate-800">
                {t('portal.password.title', 'Promjena lozinke')}
            </h2>

            {message && <p className="text-sm text-green-600">{ui(message)}</p>}
            {error && <p className="text-sm text-red-600">{ui(error)}</p>}

            <PasswordField label={t('portal.password.current', 'Trenutna lozinka')} value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)} required autoComplete="current-password" />

            <PasswordField label={t('portal.password.new', 'Nova lozinka')} value={newPassword}
                onChange={event => setNewPassword(event.target.value)} required autoComplete="new-password" />

            <PasswordField label={t('portal.password.confirm', 'Potvrda nove lozinke')} value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)} required autoComplete="new-password" />

            <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
                {submitting
                    ? t('portal.password.saving', 'Spremanje...')
                    : t('portal.password.submit', 'Spremi lozinku')}
            </button>
        </form>
    );
}
