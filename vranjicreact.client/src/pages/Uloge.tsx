import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useAuth } from '@/contexts/AuthContext';

interface RoleDescription { name: string; capabilities: string[] }

export default function Uloge() {
    const { ui } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const [roles, setRoles] = useState<RoleDescription[] | null>(null);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        getAccessToken().then(token => {
            if (!token) throw new Error('Authentication required.');
            return apiFetch<RoleDescription[]>('/api/roles', { signal: controller.signal, headers: { Authorization: token } });
        }).then(result => {
            if (!controller.signal.aborted) setRoles(result);
        }).catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => controller.abort();
    }, [attempt, getAccessToken]);

    return <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <h1 className="text-3xl font-bold">{ui('Uloge')}</h1>
        <p>{ui('Uloge određuju koje radnje možete obavljati. Ako imate više uloga, njihove se ovlasti nadopunjuju. Za pojedini sadržaj vrijede i pravila vlasništva, područja i statusa.')}</p>
        <p className="rounded border p-4">{ui('Nacrt → Pošalji na pregled → Moderator odobrava → Administrator objavljuje. Provjera izvora zaseban je korak.')}</p>
        {error ? <p role="alert">{ui('Opisi uloga trenutačno nisu dostupni.')} <button type="button" className="underline" onClick={() => { setError(false); setAttempt(value => value + 1); }}>{ui('Pokušaj ponovno')}</button></p>
            : !roles ? <p role="status">{ui('Učitavanje...')}</p>
            : roles.map(role => <section key={role.name} className="rounded border border-slate-200 p-5">
                <h2 className="text-xl font-semibold">{ui(role.name)}</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5">{role.capabilities.map(capability => <li key={capability}>{ui(capability)}</li>)}</ul>
            </section>)}
    </div>;
}
