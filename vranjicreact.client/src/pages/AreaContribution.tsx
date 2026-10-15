import { usePublicDisplay } from '@/contexts/PublicDisplayContext';
import { resolveContributionTags } from '@/lib/contribution-defaults';
import { parseTagId } from '@/components/common/TagFilter';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchArea, fetchTags } from '@/lib/classification-api';
import type { Area, Tag, ContentTimePerspective } from '@/lib/types';
import PortalBlogForm from './portal/PortalBlogForm';
import PortalNewsForm from './portal/PortalNewsForm';
import PortalAnnouncementForm from './portal/PortalAnnouncementForm';
import PortalGalleryAlbumForm from './portal/PortalGalleryAlbumForm';
import ContributionResult from '@/components/common/ContributionResult';

const choices = [
    { kind: 'prica', title: 'Priča', description: 'Sjećanje, osobna priča ili plan za budućnost. Odaberite Jučer, Danas ili Sutra.' },
    { kind: 'obavijest', title: 'Obavijest', description: 'Kratka informacija ili novost za ovo područje.' },
    { kind: 'vremenska-obavijest', title: 'Obavijest s rasporedom', description: 'Informacija s početkom prikazivanja, istekom i razinom važnosti.' },
    { kind: 'galerija', title: 'Galerija', description: 'Album fotografija ili videa. Nakon spremanja albuma dodajte fotografije.' },
] as const;

export default function AreaContribution() {
    const { ui } = useUiTranslation();
    const { slug: routeSlug, kind, contentId } = useParams<{ slug: string; kind?: string; contentId?: string }>();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const slug = routeSlug ?? params.get('area') ?? '';
    const settings = usePublicDisplay();
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [revision, setRevision] = useState(0);
    const [area, setArea] = useLocalizedContentState<Area | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        setArea(null); setError(null); setLoading(true);
        Promise.all([slug ? fetchArea(slug) : Promise.resolve(null), fetchTags()]).then(([result, tagResult]) => {
            if (active) { setArea(result); setTags(tagResult); }
        })
            .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Područja i oznake nisu dostupni.'); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [slug, setArea, revision]);

    if (error) return <p role="alert" className="mx-auto max-w-4xl p-8 text-red-700">{ui(error)} <button type="button" onClick={() => setRevision(value => value + 1)} className="underline">{ui("Pokušaj ponovno")}</button></p>;
    if (loading || settings.loading) return <p role="status" className="p-8 text-center">{ui("Učitavanje područja...")}</p>;
    const returnTo = params.get('from') === 'portal' ? '/portal' : area ? `/nase-malo-misto/${area.slug}`
        : kind === 'prica' ? '/blog' : kind === 'galerija' ? '/galerija' : '/aktualno';
    const creationBase = routeSlug && area ? `/nase-malo-misto/${area.slug}/dodaj` : '/dodaj';
    const perspective = params.get('perspective');
    const initialPerspective = ['Jucer', 'Danas', 'Sutra'].includes(perspective ?? '') ? perspective as ContentTimePerspective : undefined;
    const initialTagIds = resolveContributionTags(tags, [
        ...(area ? settings.areaTagSlugs?.[area.slug] ?? [] : []),
        ...(kind ? settings.contentTagSlugs?.[kind] ?? [] : []),
    ], parseTagId(params.get('tagId')));
    const choice = choices.find(item => item.kind === kind);
    const formProps = {
        initialAreaId: area?.id, initialTagIds, initialPerspective, returnTo,
        onCreated: (content: { id: number }) => navigate(`${creationBase}/${kind}/${content.id}?${params}`, { replace: true }),
    };
    return <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <Link to={returnTo} className="font-semibold text-blue-700">← {area?.name ?? ui("Povratak")}</Link>
        <header><h1 className="text-3xl font-bold">{ui(choice?.title ?? 'Dodaj sadržaj')}{area && <> · {area.name}</>}</h1>
            <p className="mt-2 text-slate-600">{ui("Pripremite sadržaj ovdje. Područje i dostupne oznake preuzeti su iz odabranog konteksta; možete ih promijeniti.")}</p></header>
        {!kind ? <><div className="grid gap-4 sm:grid-cols-2">{choices.filter(item => item.kind !== 'vremenska-obavijest').map(item => <Link key={item.kind} to={`${creationBase}/${item.kind}`} className="rounded-xl border border-slate-200 p-5 hover:border-blue-500">
            <h2 className="text-xl font-semibold">{ui(item.title)}</h2><p className="mt-2 text-sm text-slate-600">{ui(item.description)}</p>
        </Link>)}</div><details className="rounded border p-4"><summary className="cursor-pointer">{ui('Napredne mogućnosti')}</summary>
            <p className="my-2 text-sm">{ui('Za najavu s početkom prikazivanja, važnosti ili neobaveznim istekom koristite napredni obrazac.')}</p>
            <Link to={`${creationBase}/vremenska-obavijest`} className="text-blue-700 underline">{ui('Obavijest s rasporedom')}</Link>
        </details></> : !choice ? <p role="alert">{ui("Nepoznata vrsta sadržaja.")}</p> : contentId ?
            <ContributionResult key={`${kind}-${contentId}`} kind={choice.kind} id={Number(contentId)} returnTo={returnTo} /> :
            <div key={`${area?.id ?? 'all'}-${kind}`} className="rounded-xl border border-slate-200 bg-white p-5">
                {kind === 'prica' && <PortalBlogForm {...formProps} />}
                {kind === 'obavijest' && <PortalNewsForm {...formProps} />}
                {kind === 'vremenska-obavijest' && <PortalAnnouncementForm {...formProps} />}
                {kind === 'galerija' && <PortalGalleryAlbumForm {...formProps} />}
            </div>}
    </div>;
}
