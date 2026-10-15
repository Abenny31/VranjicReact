import ShareContent from '@/components/common/ShareContent';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchBlogPostDetail } from '@/lib/blog-api';
import { originLabels, perspectiveLabels, sourceTypeLabels } from '@/lib/content-labels';
import type { BlogPostDetail } from '@/lib/types';

export default function BlogDetalj() {
    const { ui, locale } = useUiTranslation();
    const { slug } = useParams<{ slug: string }>();
    const [post, setPost] = useLocalizedContentState<BlogPostDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) {
            setError('Priča nije pronađena.');
            setLoading(false);
            return;
        }

        let active = true;
        fetchBlogPostDetail(slug)
            .then(result => {
                if (active) setPost(result);
            })
            .catch(reason => {
                if (active) setError(reason instanceof Error ? reason.message : 'Priča se ne može učitati.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [slug, setPost]);

    const paragraphs = useMemo(
        () => post?.body.split(/\r?\n\r?\n/).map(value => value.trim()).filter(Boolean) ?? [],
        [post]
    );

    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <Link to="/blog" className="text-sm font-semibold text-primary-700 dark:text-blue-300">{ui("← Sve priče")}</Link>

            {loading && <p className="mt-10 text-slate-500">{ui("Učitavanje priče...")}</p>}
            {error && <p className="mt-10 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{ui(error)}</p>}

            {!loading && !error && post && (
                <article className="mt-8">
                    <header>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
                            {post.area && <Link to={`/nase-malo-misto/${post.area.slug}`}>{post.area.name}</Link>}
                            {post.timePerspective && <span>{ui(perspectiveLabels[post.timePerspective])}</span>}
                            {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString(locale)}</span>}
                        </div>
                        <h1 className="mt-4 text-4xl font-bold text-slate-900 dark:text-white">{post.title}</h1>
                        <p className="mt-4 text-lg text-slate-600 dark:text-white/70">{post.excerpt}</p>
                        {post.origin && (
                            <p className="mt-4 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                                {ui(originLabels[post.origin])}
                                {post.verifiedAt ? ui(' · provjereno {date}', { date: new Date(post.verifiedAt).toLocaleDateString(locale) }) : ''}
                            </p>
                        )}
                    </header>
                    <ShareContent title={post.title} text={post.excerpt} path={`/blog/${post.id}`} />

                    {post.heroImageUrl && <img src={post.heroImageUrl} alt="" className="mt-8 max-h-[32rem] w-full rounded-2xl object-cover" />}

                    <div className="mt-8 space-y-5 text-lg leading-relaxed text-slate-700 dark:text-white/80">
                        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>

                    {post.tags.length > 0 && (
                        <div className="mt-8 flex flex-wrap gap-2">
                            {post.tags.map(tag => <span key={tag.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tag.name}</span>)}
                        </div>
                    )}

                    {post.sources.length > 0 && (
                        <section className="mt-12 border-t border-slate-200 pt-8">
                            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{ui("Izvori")}</h2>
                            <ol className="mt-5 space-y-4">
                                {post.sources.map(source => (
                                    <li key={source.id} className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                        <p className="font-semibold">{source.title}</p>
                                        <p className="mt-1 text-slate-500">{[source.author, source.year, ui(sourceTypeLabels[source.type])].filter(Boolean).join(' · ')}</p>
                                        {source.note && <p className="mt-2">{source.note}</p>}
                                        {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-semibold text-primary-700">{ui("Otvori izvor ↗")}</a>}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </article>
            )}
        </div>
    );
}
