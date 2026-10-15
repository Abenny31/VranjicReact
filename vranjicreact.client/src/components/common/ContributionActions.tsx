import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { CONTENT_CREATE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import { contributionPath, type ContributionKind } from '@/lib/contribution-defaults';

interface Props { area?: string; tagId?: string; perspective?: string; from?: string; kind?: ContributionKind }
export default function ContributionActions({ kind, ...context }: Props) {
    const { status, hasRole } = useAuth();
    const { ui } = useUiTranslation();
    if (status !== 'authenticated' || !hasAnyRole(hasRole, CONTENT_CREATE_ROLES)) return null;
    const actions = [
        { kind: 'obavijest', label: 'Nova objava' },
        { kind: 'prica', label: 'Dodaj priču' },
        { kind: 'galerija', label: 'Dodaj fotografije' },
    ] as const;
    return <nav aria-label={ui('Dodavanje sadržaja')} className="my-5 flex flex-wrap gap-3">
        {actions.filter(action => !kind || action.kind === kind).map(action =>
            <Link key={action.kind} to={contributionPath(action.kind, context)} className="rounded border border-blue-300 bg-white px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50">
                {ui(action.label)}
            </Link>)}
    </nav>;
}
