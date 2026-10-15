import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { CONTENT_CREATE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import { fetchMyContent, type MyContentPage } from '@/lib/my-content-api';
import ContributionActions from '@/components/common/ContributionActions';
import EditorialPanel from '@/components/common/EditorialPanel';
import ListPagination from '@/components/common/ListPagination';
import PublicationHelp from '@/components/common/PublicationHelp';

export default function PortalDashboard() {
    const { ui } = useUiTranslation();
    const { hasRole, getAccessToken } = useAuth();
    const canCreate = hasAnyRole(hasRole, CONTENT_CREATE_ROLES);
    const [page, setPage] = useState(1);
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<MyContentPage | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!canCreate) return;
        const controller = new AbortController();
        setResult(null); setError(null);
        getAccessToken().then(async token => {
            if (controller.signal.aborted) return;
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            const next = await fetchMyContent(page, token, controller.signal);
            if (!controller.signal.aborted) setResult(next);
        }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Sadržaj nije dostupan.'); });
        return () => controller.abort();
    }, [canCreate, getAccessToken, page, revision]);

    const paths = { News: 'news', Blog: 'blog', Announcement: 'announcements', Gallery: 'gallery/albums' };
    return <div className="space-y-5">
        <h2 className="text-2xl font-semibold">{ui('Dobrodošli!')}</h2>
        <ContributionActions from="portal" />
        {canCreate ? <>
            <h3 className="text-xl font-semibold">{ui('Moji sadržaji i status pregleda')}</h3>
            {!result && !error && <p role="status">{ui('Učitavanje...')}</p>}
            {error && <p role="alert">{ui(error)} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>{ui('Pokušaj ponovno')}</button></p>}
            {result?.items.length === 0 && <p>{ui('Još nemate vlastitih objava. Odaberite jednu od akcija iznad.')}</p>}
            {result?.items.map(item => <article key={`${item.contentType}-${item.id}`} className="space-y-3 rounded border border-slate-200 p-4">
                <h4 className="font-semibold">{item.title}</h4>
                <Link to={`/portal/${paths[item.contentType]}/${item.id}/edit`} className="text-blue-700 underline">
                    {ui(item.canEdit ? 'Nastavi uređivati' : 'Pregledaj')}
                </Link>
                <EditorialPanel type={item.contentType} id={item.id} status={item.editorialStatus} rowVersion={item.rowVersion}
                    canSubmit={item.canSubmit} onChanged={() => setRevision(value => value + 1)} />
            </article>)}
            {result && <ListPagination page={page} hasMore={result.hasMore} onPageChange={setPage} />}
            <details><summary className="cursor-pointer">{ui('Kako objaviti sadržaj?')}</summary><PublicationHelp /></details>
        </> : <p>{ui('Odaberite dostupnu radnju u izborniku portala.')}</p>}
    </div>;
}
