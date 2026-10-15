import { useUiTranslation } from '@/hooks/useUiTranslation';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CONTENT_CREATE_ROLES, hasAnyRole } from '@/lib/auth-roles';

export default function AreaContributionLink({ slug }: { slug: string }) {
    const { ui } = useUiTranslation();
    const { status, hasRole } = useAuth();
    if (status === 'loading' || (status === 'authenticated' && !hasAnyRole(hasRole, CONTENT_CREATE_ROLES))) return null;
    return <Link to={`/nase-malo-misto/${slug}/dodaj`} className="inline-flex text-sm text-slate-600 underline underline-offset-4 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">
        {status === 'authenticated' ? ui("Dodaj sadržaj u ovo područje") : ui("Prijavi se i dodaj sadržaj")}
    </Link>;
}
