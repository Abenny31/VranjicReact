import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronDown, IconRss } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PORTAL_ACCESS_ROLES, hasAnyRole } from '@/lib/auth-roles';
import { AREAS_CHANGED_EVENT, fetchAreas } from '@/lib/classification-api';
import type { Area } from '@/lib/types';
import { usePublicDisplay } from '@/contexts/PublicDisplayContext';

import { useOnClickOutside } from '~/hooks/useOnClickOutside';
import Logo from '~/components/atoms/Logo';
import ToggleMenu from '~/components/atoms/ToggleMenu';
import CTA from '~/components/common/CTA';

import { headerData } from '~/shared/data/global.data';
import { CallToActionType } from '~/shared/types';

const Header = () => {
    const { ui } = useUiTranslation();
    const { initialAreaCount } = usePublicDisplay();
    const { status, hasRole, logout } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const { actions, isSticky, showRssFeed, position } = headerData;
    const showPortal = status === 'authenticated' && hasAnyRole(hasRole, PORTAL_ACCESS_ROLES);
    const showLogin = status === 'unauthenticated';
    const showLogout = status === 'authenticated';
    const [areas, setAreas] = useLocalizedContentState<Area[]>([]);

    useEffect(() => {
        let controller: AbortController | undefined;
        const refreshAreas = () => {
            controller?.abort();
            const request = new AbortController();
            controller = request;
            fetchAreas(request.signal).then(result => {
                if (!request.signal.aborted) setAreas(result);
            }).catch(() => {
                if (!request.signal.aborted) setAreas([]);
            });
        };
        refreshAreas();
        window.addEventListener(AREAS_CHANGED_EVENT, refreshAreas);
        window.addEventListener('focus', refreshAreas);
        return () => {
            controller?.abort();
            window.removeEventListener(AREAS_CHANGED_EVENT, refreshAreas);
            window.removeEventListener('focus', refreshAreas);
        };
    }, [setAreas]);

    const navLinks = useMemo(
        () => [
            {
                label: t('nav.home', 'Početna'),
                href: '/',
            },
            {
                label: t('nav.updates', 'Obavijesti'),
                href: '/aktualno',
            },
            {
                label: t('nav.blog', 'Priče'),
                href: '/blog',
            },
            {
                label: t('nav.gallery', 'Galerija'),
                href: '/galerija',
            },
            {
                label: t('nav.areas', 'Naše malo misto'),
                href: '/nase-malo-misto',
                icon: IconChevronDown,
                links: [
                    ...areas.slice(0, initialAreaCount).map(area => ({
                        label: area.name,
                        href: `/nase-malo-misto/${area.slug}`,
                    })),
                    {
                        label: t('nav.areas.all', 'Prikaži sve'),
                        href: '/nase-malo-misto?all=1',
                    },
                ],
            },
            {
                label: t('nav.about', 'O nama'),
                href: '/onama',
            },
            {
                label: t('nav.contact', 'Kontakt'),
                href: '/kontakt',
            },
        ],
        [areas, initialAreaCount, t]
    );

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error('Neuspjesna odjava', error);
        }
    };

    const ref = useRef<HTMLUListElement | null>(null);

    const updatedIsDropdownOpen = navLinks.map(() => false);
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean[]>(updatedIsDropdownOpen);
    const [isToggleMenuOpen, setIsToggleMenuOpen] = useState(false);

    const handleDropdownOnClick = (idx: number) => {
        setIsDropdownOpen(prev => prev.map((value, index) => (index === idx ? !value : false)));
    };

    const handleCloseDropdownOnClick = (idx: number) => {
        setIsDropdownOpen(prev => prev.map((value, index) => (index === idx ? false : value)));
    };

    const handleToggleMenuOnClick = () => setIsToggleMenuOpen(open => !open);
    const handleCloseMenu = () => setIsToggleMenuOpen(false);

    useOnClickOutside(ref, () => setIsDropdownOpen(updatedIsDropdownOpen));

    return (
        <header
            id="header"
            className={`top-0 z-40 mx-auto w-full flex-none transition-all duration-100 ease-in
        ${isSticky ? 'sticky' : 'relative'}
        ${isToggleMenuOpen ? 'h-screen md:h-auto' : 'h-auto'}
        bg-white dark:bg-slate-900 md:bg-white/90 md:backdrop-blur-sm dark:md:bg-slate-900/90`}
        >
            <div className="mx-auto w-full max-w-7xl md:flex md:justify-between md:py-3.5 md:px-4">
                <div
                    className={`flex justify-between py-3 px-3 md:py-0 md:px-0 ${
                        isToggleMenuOpen
                            ? 'md:bg-transparent md:dark:bg-transparent md:border-none bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-600'
                            : ''
                    }`}
                >
                    <Link
                        to="/"
                        className="flex items-center"
                        onClick={() =>
                            isToggleMenuOpen
                                ? handleToggleMenuOnClick()
                                : setIsDropdownOpen(updatedIsDropdownOpen)
                        }
                    >
                        <Logo />
                    </Link>

                    <div className="flex items-center md:hidden">
                        <ToggleMenu
                            handleToggleMenuOnClick={handleToggleMenuOnClick}
                            isToggleMenuOpen={isToggleMenuOpen}
                        />
                    </div>
                </div>

        {/* Nav links */}
                <nav
                    aria-label={ui("Main navigation")}
                    className={`${isToggleMenuOpen ? 'block px-3' : 'hidden'}
            h-screen md:w-full
            ${
                position === 'right'
                    ? 'justify-end'
                    : position === 'left'
                      ? 'justify-start'
                      : 'justify-center'
            }
            w-auto overflow-y-auto dark:text-slate-200 md:mx-5 md:flex md:h-auto md:items-center md:overflow-visible`}
                >
                    <ul
                        ref={ref}
                        className="flex w-full flex-col mt-2 mb-36 md:m-0 text-xl
              md:w-auto md:flex-row md:self-center md:pt-0 md:text-base"
                    >
                        {navLinks.map(({ label, href, icon: Icon, links: sub }, idx) => (
                            <li key={href} className={sub?.length ? 'dropdown' : ''}>
                                {sub && sub.length ? (
                                    <>
                                        <div className="flex items-center">
                                            <Link
                                                to={href}
                                                className="flex items-center py-3 pl-4 font-medium transition duration-150 ease-in-out hover:text-gray-900 dark:hover:text-white"
                                                onClick={handleCloseMenu}
                                            >
                                                {label}
                                            </Link>
                                            <button
                                                type="button"
                                                onKeyDown={event => { if (event.key === 'Escape') handleCloseDropdownOnClick(idx); }}
                                                aria-label={ui("Otvori izbornik {label}", { label })}
                                                aria-expanded={isDropdownOpen[idx]}
                                                className="px-2 py-3"
                                                onClick={() => handleDropdownOnClick(idx)}
                                            >
                                                {Icon && (
                                                <Icon
                                                    className={`ml-1 h-4 w-4 transition-transform ${
                                                        isDropdownOpen[idx] ? 'rotate-180' : ''
                                                    }`}
                                                />
                                                )}
                                            </button>
                                        </div>
                                        <ul
                                            className={`dropdown-menu ${isDropdownOpen[idx] ? 'open' : ''}`}
                                            aria-label={ui("Podizbornik {label}", { label })}
                                            onKeyDown={event => {
                                                if (event.key === 'Escape') {
                                                    handleCloseDropdownOnClick(idx);
                                                    event.currentTarget.parentElement?.querySelector('button')?.focus();
                                                }
                                            }}
                                        >
                                            {sub.map((item, subIdx) => (
                                                <li key={subIdx}>
                                                    <Link
                                                        to={item.href as string}
                                                        className="flex items-center px-4 py-3 text-sm transition duration-150 ease-in-out hover:text-gray-900 dark:hover:text-white"
                                                        onClick={() =>
                                                            isToggleMenuOpen
                                                                ? handleToggleMenuOnClick()
                                                                : handleCloseDropdownOnClick(idx)
                                                        }
                                                    >
                                                        {item.label}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : (
                                    <Link
                                        to={href as string}
                                        className="flex items-center px-4 py-3 font-medium transition duration-150 ease-in-out hover:text-gray-900 dark:hover:text-white"
                                        onClick={() =>
                                            isToggleMenuOpen ? handleToggleMenuOnClick() : handleDropdownOnClick(idx)
                                        }
                                    >
                                        {label}
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>

                <div
                    className={`${isToggleMenuOpen ? 'block' : 'hidden'} fixed bottom-0 left-0 w-full justify-end p-3
            md:static md:mb-0 md:flex md:w-auto md:self-center md:p-0
            md:bg-transparent md:dark:bg-transparent md:border-none
            bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-600`}
                >
                    <div className="flex w-full items-center justify-between md:w-auto">
                        {/* {showToggleTheme && <ToggleDarkMode />} */}

                        {showRssFeed && (
                            <a
                                className="text-muted inline-flex items-center rounded-lg p-2.5 text-sm hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
                                aria-label={ui("RSS Feed")}
                                href="/feed.xml"
                            >
                                <IconRss className="h-5 w-5" />
                            </a>
                        )}

                        {actions && actions.length > 0 && (
                            <div className="ml-4 rtl:ml-0 rtl:mr-4 flex w-max flex-wrap justify-end">
                                {actions.map((cta, i) => (
                                    <CTA
                                        key={i}
                                        callToAction={cta as CallToActionType}
                                        linkClass="btn btn-primary m-1 py-2 px-5 text-sm font-semibold shadow-none md:px-6"
                                    />
                                ))}
                            </div>
                        )}

                        <div className="ml-4 flex items-center gap-2">
                            {(['hr', 'en'] as const).map(option => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setLanguage(option)}
                                    className={`rounded border px-2 py-1 text-xs font-semibold transition ${
                                        language === option
                                            ? 'border-blue-500 bg-blue-500 text-white'
                                            : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800'
                                    }`}
                                >
                                    {option.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {(showPortal || showLogin || showLogout) && (
                            <div className="ml-4 flex items-center gap-2">
                                {showPortal && (
                                    <Link
                                        to="/portal"
                                        onClick={handleCloseMenu}
                                        className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                    >
                                        {t('action.portal', 'Portal')}
                                    </Link>
                                )}
                                {showLogout && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            handleCloseMenu();
                                            await handleLogout();
                                        }}
                                        className="rounded bg-red-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-600 whitespace-nowrap"
                                    >
                                        {t('action.logout', 'Odjava')}
                                    </button>
                                )}
                                {showLogin && (
                                    <Link
                                        to="/login"
                                        onClick={handleCloseMenu}
                                        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 whitespace-nowrap"
                                    >
                                        {t('action.login', 'Prijava')}
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
