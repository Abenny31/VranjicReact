import { lazy, Suspense } from 'react';
import { useUiTranslation } from '@/hooks/useUiTranslation';

const UserForm = lazy(() => import('./portal/PortalUserForm'));
const AcceptInvitation = lazy(() => import('./AcceptInvitation'));

function LoadingAccountPage() {
    const { ui } = useUiTranslation();
    return <p role="status" className="text-sm text-slate-500">{ui('Učitavanje...')}</p>;
}

export function LazyUserForm() {
    return <Suspense fallback={<LoadingAccountPage />}><UserForm /></Suspense>;
}

export function LazyAcceptInvitation() {
    return <Suspense fallback={<LoadingAccountPage />}><AcceptInvitation /></Suspense>;
}
