import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAreas } from '@/lib/classification-api';
import type { Area } from '@/lib/types';
import { usePublicDisplay } from '@/contexts/PublicDisplayContext';

export default function NaseMaloMisto() {
    const { ui } = useUiTranslation();
    const { initialAreaCount, unavailable } = usePublicDisplay();
    const [params, setParams] = useSearchParams();
    const showAll = params.get('all') === '1';
    const [areas, setAreas] = useLocalizedContentState<Area[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        fetchAreas()
            .then(result => {
                if (active) {
                    setAreas(result);
                }
            })
            .catch(reason => {
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'Područja se trenutačno ne mogu učitati.');
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [setAreas]);

    return (
        <div className="mx-auto max-w-6xl px-4 py-12">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{ui("Naše malo misto")}</h1>
                <p className="mt-3 text-slate-600 dark:text-white/70">
                    {ui("Priče, događaji i galerije povezani s ljudima i mjestima Vranjica.")} </p>
            </header>

            {loading && <p className="text-center text-slate-600 dark:text-white/70">{ui("Učitavanje područja...")}</p>}
            {unavailable && <p role="status" className="mb-4 text-sm">{ui('Postavke prikaza nisu dostupne. Ostala područja možete otvoriti putem „Prikaži sve”.')}</p>}
            {error && !loading && (
                <p className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">{ui(error)}</p>
            )}
            {!loading && !error && areas.length === 0 && (
                <p className="text-center text-slate-600 dark:text-white/70">{ui("Područja još nisu objavljena.")}</p>
            )}

            {!loading && !error && areas.length > 0 && (
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {(showAll ? areas : areas.slice(0, initialAreaCount)).map(area => (
                        <li
                            key={area.id}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-white/5"
                        >
                            {area.coverImageUrl && (
                                <img
                                    src={area.coverImageUrl}
                                    alt=""
                                    loading="lazy"
                                    className="h-48 w-full object-cover"
                                />
                            )}
                            <div className="space-y-3 p-5">
                                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{area.name}</h2>
                                {area.shortDescription && (
                                    <p className="text-sm text-slate-600 dark:text-white/70">{area.shortDescription}</p>
                                )}
                                <Link
                                    to={`/nase-malo-misto/${area.slug}`}
                                    className="inline-flex text-sm font-semibold text-primary-700 hover:text-primary-900 dark:text-blue-300"
                                >
                                    {ui("Otvori područje →")} </Link>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {!loading && !error && areas.length > initialAreaCount && <button type="button" className="mt-6 rounded border px-4 py-2" onClick={() => {
                const next = new URLSearchParams(params);
                if (showAll) next.delete('all'); else next.set('all', '1');
                setParams(next);
            }}>{ui(showAll ? 'Prikaži manje' : 'Prikaži sve')}</button>}
        </div>
    );
}
