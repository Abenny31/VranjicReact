import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBlogPostDetail } from '@/lib/blog-api';
import { fetchNewsDetail } from '@/lib/news-api';
import { fetchAnnouncementDetail } from '@/lib/announcements-api';
import { fetchGalleryAlbum } from '@/lib/gallery-api';
import type { EditorialStatus } from '@/lib/types';
import EditorialPanel from './EditorialPanel';

const contentTypes = { prica: 'Blog', obavijest: 'News', 'vremenska-obavijest': 'Announcement', galerija: 'Gallery' } as const;
type Kind = keyof typeof contentTypes;
interface SavedContent {
    title: string;
    rowVersion: string;
    editorialStatus?: EditorialStatus | null;
    canSubmit: boolean;
    canEdit: boolean;
}

export default function ContributionResult({ kind, id, returnTo }: { kind: Kind; id: number; returnTo: string }) {
    const { ui } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const [content, setContent] = useState<SavedContent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setContent(null); setError(null);
        const load = async () => {
            if (!Number.isSafeInteger(id) || id < 1) throw new Error('Neispravan sadržaj.');
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            const options = { authorization: token, includeUnpublished: true };
            if (kind === 'prica') return fetchBlogPostDetail(String(id), options);
            if (kind === 'obavijest') return fetchNewsDetail(String(id), options);
            if (kind === 'vremenska-obavijest') return fetchAnnouncementDetail(String(id), options);
            return (await fetchGalleryAlbum(id, token)).album;
        };
        load().then(result => { if (active) setContent(result); })
            .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Sadržaj nije dostupan.'); });
        return () => { active = false; };
    }, [getAccessToken, id, kind, revision]);
    if (error) return <p role="alert">{ui(error)} <button onClick={() => setRevision(value => value + 1)} className="underline">{ui("Pokušaj ponovno")}</button></p>;
    if (!content) return <p role="status">{ui("Učitavanje spremljenog sadržaja...")}</p>;
    const editPath = kind === 'galerija' ? `/portal/gallery/${id}` : `/portal/${kind === 'prica' ? 'blog' : kind === 'obavijest' ? 'news' : 'announcements'}/${id}/edit`;
    return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">{content.title}</h2>
        <p role="status">{ui("Sadržaj je spremljen.")}</p>
        {content.canSubmit && <p>{ui("Sljedeći korak: kad završite pripremu, odaberite „Pošalji na pregled”. Nacrt se još ne prikazuje posjetiteljima ni moderatorskom redu.")}</p>}
        {content.editorialStatus === 'PendingReview' && <p>{ui("Zahtjev je poslan. Sadržaj čeka pregled ovlaštene osobe; zasad ga ne možete uređivati.")}</p>}
        {content.editorialStatus === 'Approved' && <p>{ui("Sadržaj je odobren i čeka objavu administratora.")}</p>}
        {content.editorialStatus === 'Published' && <p>{ui("Sadržaj je objavljen ili zakazan. Javno se prikazuje kada nastupi datum objave, a za obavijest s rokom i početak prikaza.")}</p>}
        {kind === 'galerija' && content.canEdit && <Link to={`/portal/gallery/new?albumId=${id}`} className="inline-flex rounded bg-blue-600 px-4 py-2 text-white">{ui("Dodaj fotografije ili video")}</Link>}
        <EditorialPanel type={contentTypes[kind]} id={id} status={content.editorialStatus} rowVersion={content.rowVersion} canSubmit={content.canSubmit} onChanged={() => setRevision(value => value + 1)} />
        <div className="flex flex-wrap gap-4">
            {content.canEdit && <Link to={editPath} className="text-blue-700 underline">{kind === 'galerija' ? ui("Otvori album") : ui("Uredi spremljeni sadržaj")}</Link>}
            <Link to={returnTo} className="text-blue-700 underline">{ui("Povratak na sadržaj")}</Link>
        </div>
    </section>;
}
