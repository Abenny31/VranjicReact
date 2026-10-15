import React, { useMemo } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PORTAL_ACCESS_ROLES } from '@/lib/auth-roles';

interface ProtectedRouteProps {
    requiredRoles?: string | readonly string[];
    redirectTo?: string;
    children?: React.ReactNode;
}

export default function ProtectedRoute({ requiredRoles, redirectTo = '/', children }: ProtectedRouteProps) {
    const { status, hasRole } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();

    const roles = useMemo(() => {
        if (!requiredRoles) {
            return [...PORTAL_ACCESS_ROLES];
        }

        return typeof requiredRoles === 'string' ? [requiredRoles] : [...requiredRoles];
    }, [requiredRoles]);

    if (status === 'loading') {
        return <div className="py-10 text-center text-slate-500">{t('common.loading', 'Učitavanje...')}</div>;
    }

    if (status !== 'authenticated') {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    const isAllowed = roles.length === 0 || roles.some(role => hasRole(role));

    if (!isAllowed) {
        return <Navigate to={redirectTo} replace />;
    }

    if (children) {
        return <>{children}</>;
    }

    return <Outlet />;
}
