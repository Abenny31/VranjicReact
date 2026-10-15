import { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PortalLayout() {
    const { user, logout, hasRole } = useAuth();
    const { t } = useLanguage();

    const navItems = useMemo(() => {
        const items: Array<{ to: string; label: string; end?: boolean }> = [
            { to: '.', label: t('portal.nav.overview', 'Pregled'), end: true },
        ];
        const canCreateContent = hasRole('SuperUser')
            || hasRole('Administrator')
            || hasRole('Moderator')
            || hasRole('Korisnik');

        if (canCreateContent) {
            items.push({ to: 'updates', label: 'Obavijesti' });
            items.push({ to: 'blog', label: 'Priče' });
            items.push({ to: 'gallery', label: t('portal.nav.gallery', 'Galerija') });
        } else if (hasRole('Provjeravatelj')) {
            items.push({ to: 'blog', label: 'Priče za provjeru' });
        }

        if (hasRole('SuperUser') || hasRole('Administrator') || hasRole('Moderator')) {
            items.push({ to: 'moderation', label: 'Moderatorski red' });
        }

        if (hasRole('SuperUser') || hasRole('Administrator')) {
            items.push({ to: 'users', label: t('portal.nav.users', 'Korisnici') });
            items.push({ to: 'contacts', label: t('portal.nav.contacts', 'Kontakt poruke') });
            items.push({ to: 'areas', label: 'Područja' });
            items.push({ to: 'tags', label: 'Oznake' });
            items.push({ to: 'moderator-assignments', label: 'Dodjele moderatora' });
        }

        items.push({ to: '/uloge', label: t('Uloge', 'Uloge') });
        items.push({ to: 'password', label: t('portal.nav.password', 'Promjena lozinke') });
        return items;
    }, [hasRole, t]);

    const subtitleTemplate = t('portal.subtitle', 'Prijavljeni ste kao {email}');
    const subtitle =
        user?.email || user?.id
            ? subtitleTemplate.replace('{email}', user.nickname ? `${user.nickname} (${user.email})` : user.email ?? user.id)
            : null;

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 py-8">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-800">{t('portal.title', 'Administracija')}</h1>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
                <button
                    type="button"
                    onClick={() => void logout()}
                    className="self-start rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {t('action.logout', 'Odjava')}
                </button>
            </header>

            <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                {navItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                            `rounded px-3 py-1.5 text-sm font-semibold transition ${
                                isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`
                        }
                    >
                        {t(item.label, item.label)}
                    </NavLink>
                ))}
            </nav>

            <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
                <Outlet />
            </section>
        </div>
    );
}
