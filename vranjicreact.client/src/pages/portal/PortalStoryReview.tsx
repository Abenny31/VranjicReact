import ContentImage from '@/components/common/ContentImage';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { fetchBlogPostDetail, verifyBlogPost } from '@/lib/blog-api';
import type { BlogPostDetail } from '@/lib/types';

export default function PortalStoryReview() {
    const { id } = useParams();
    const { getAccessToken } = useAuth();
    const { ui } = useUiTranslation();
    const [story, setStory] = useState<BlogPostDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setStory(null); setError(null);
        getAccessToken().then(async token => {
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            return fetchBlogPostDetail(id ?? '', { authorization: token, includeUnpublished: true, signal: controller.signal });
        }).then(value => { if (!controller.signal.aborted) setStory(value); })
            .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Priča nije dostupna.'); });
        return () => controller.abort();
    }, [id, getAccessToken, attempt]);

    const verify = async () => {
        if (!story || busy || !story.sources.length) return;
        if (!window.confirm(ui('Potvrđujete li da ste pregledali priču i navedene izvore? Ova radnja označava sadržaj kao provjeren, ali ga ne objavljuje.'))) return;
        setBusy(true); setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            await verifyBlogPost(story.id, token);
            setAttempt(value => value + 1);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Provjera nije spremljena.'); }
        finally { setBusy(false); }
    };

    return <article className="max-w-4xl space-y-4">
        <Link to="/portal/blog" className="text-blue-700 underline">{ui('Povratak na priče')}</Link>
        <h2 className="text-2xl font-semibold">{ui('Pregled priče i izvora')}</h2>
        {error && <p role="alert" className="text-red-700">{ui(error)} <button type="button" onClick={() => setAttempt(value => value + 1)} className="underline">{ui('Pokušaj ponovno')}</button></p>}
        {!story && !error && <p role="status">{ui('Učitavanje...')}</p>}
        {story && <>
            <h3 className="text-xl font-semibold">{story.title}</h3>
            <p>{story.area?.name}</p><p>{story.excerpt}</p>
            {story.heroImageUrl && <ContentImage src={story.heroImageUrl} alt={story.title} />}
            <div className="whitespace-pre-wrap">{story.body}</div>
            <h3 className="text-lg font-semibold">{ui('Izvori')}</h3>
            <ol className="list-decimal space-y-3 pl-5">{story.sources.map(source => <li key={source.id}>
                <p className="font-semibold">{source.title}</p>
                <p>{[source.author, source.year].filter(Boolean).join(' · ')}</p>
                {source.note && <p>{source.note}</p>}
                {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-blue-700 underline">{ui('Otvori izvor ↗')}</a>}
            </li>)}</ol>
            {!story.sources.length && <p>{ui('Za provjeru je potrebno navesti najmanje jedan izvor. Izvore dodaje autor ili administrator.')}</p>}
            {story.origin === 'DocumentedAndVerified' ? <p role="status">{ui('Priča je označena kao dokumentirana i provjerena.')}</p> :
                <button type="button" disabled={busy || !story.sources.length} onClick={() => void verify()} className="rounded border border-emerald-500 px-4 py-2 disabled:opacity-50">{ui('Označi kao dokumentirano i provjereno')}</button>}
        </>}
    </article>;
}
