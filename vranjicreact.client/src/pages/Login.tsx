import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PORTAL_ACCESS_ROLES, userHasAnyRole } from '@/lib/auth-roles';
import { useLanguage } from '@/contexts/LanguageContext';
import PasswordField from '@/components/common/PasswordField';
import SupportContact from '@/components/common/SupportContact';

const SUPPORT_AFTER_FAILED_ATTEMPTS = 10;

export default function Login() {
    const { ui } = useUiTranslation();
    const { status, user, login } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    const redirectPath = ((location.state as { from?: { pathname?: string } })?.from?.pathname) ?? '/portal';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const canAccessPortal = userHasAnyRole(user, PORTAL_ACCESS_ROLES);

    if (status === 'authenticated') {
        return <Navigate to={canAccessPortal || redirectPath === '/uloge' ? redirectPath : '/'} replace />;
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSubmitting) return;
        setError(null);
        setIsSubmitting(true);

        try {
            await login(email, password);
            setFailedAttempts(0);
        } catch (err) {
            setFailedAttempts(count => Math.min(count + 1, SUPPORT_AFTER_FAILED_ATTEMPTS));
            const message = err instanceof Error ? err.message : 'Prijava nije uspjela. Pokusajte ponovno.';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-md py-10">
            <h1 className="mb-6 text-3xl font-semibold text-slate-800">{t('login.title', 'Prijava')}</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-600">
                        {t('login.email', 'Email adresa')}
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        required
                        autoComplete="username"
                        className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                </div>
                <PasswordField id="password" label={t('login.password', 'Lozinka')}
                    value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" />
                {error && <p className="text-sm text-red-600">{ui(error)}</p>}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded bg-blue-600 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                    {isSubmitting ? t('login.submitting', 'Prijava...') : t('login.submit', 'Prijavi se')}
                </button>
            </form>
            {failedAttempts >= SUPPORT_AFTER_FAILED_ATTEMPTS && <div className="mt-3"><SupportContact /></div>}
        </div>
    );
}

