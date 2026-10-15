import ContributionActions from '@/components/common/ContributionActions';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchArea } from '@/lib/classification-api';
import { fetchGalleryAlbums } from '@/lib/gallery-api';
import { fetchNews } from '@/lib/news-api';
import { fetchAnnouncements } from '@/lib/announcements-api';
import { fetchBlogPosts } from '@/lib/blog-api';
import AreaContributionLink from '@/components/common/AreaContributionLink';
import type { AnnouncementSummary, Area, BlogPostSummary, GalleryAlbumSummary, NewsSummary } from '@/lib/types';

export default function Podrucje() {
    const { ui } = useUiTranslation();
    const { slug } = useParams<{ slug: string }>();
    const [area, setArea] = useLocalizedContentState<Area | null>(null);
    const [news, setNews] = useLocalizedContentState<NewsSummary[]>([]);
    const [albums, setAlbums] = useLocalizedContentState<GalleryAlbumSummary[]>([]);
    const [announcements, setAnnouncements] = useLocalizedContentState<AnnouncementSummary[]>([]);
    const [blogPosts, setBlogPosts] = useLocalizedContentState<BlogPostSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) {
            setError('Područje nije pronađeno.');
            setLoading(false);
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);

        Promise.all([
            fetchArea(slug),
            fetchNews({ area: slug }),
            fetchGalleryAlbums({ area: slug }),
            fetchAnnouncements({ area: slug }),
            fetchBlogPosts({ area: slug }),
        ])
            .then(([areaResult, newsResult, albumResult, announcementResult, blogResult]) => {
                if (active) {
                    setArea(areaResult);
                    setNews(newsResult);
                    setAlbums(albumResult);
                    setAnnouncements(announcementResult);
                    setBlogPosts(blogResult);
                }
            })
            .catch(reason => {
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'Područje se trenutačno ne može učitati.');
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
    }, [slug, setArea, setNews, setAlbums, setAnnouncements, setBlogPosts]);

    const groupedContent = useMemo(() => {
        const content = [
            ...news.map(item => ({ key: `news-${item.id}`, title: item.title, excerpt: item.excerpt, perspective: item.timePerspective, href: `/novosti/${item.slug}`, label: 'Obavijest' })),
            ...blogPosts.map(item => ({ key: `blog-${item.id}`, title: item.title, excerpt: item.excerpt, perspective: item.timePerspective, href: `/blog/${item.slug}`, label: 'Priča' })),
            ...albums.map(item => ({ key: `album-${item.id}`, title: item.title, excerpt: item.description, perspective: item.timePerspective, href: `/galerija/${item.id}`, label: 'Galerija' })),
        ];
        return {
            Jucer: content.filter(item => item.perspective === 'Jucer'),
            Danas: content.filter(item => item.perspective === 'Danas'),
            Sutra: content.filter(item => item.perspective === 'Sutra'),
        };
    }, [news, blogPosts, albums]);

    if (loading) {
        return <p className="mx-auto max-w-6xl px-4 py-12 text-center text-slate-600">{ui("Učitavanje područja...")}</p>;
    }

    if (error || !area) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-12 text-center">
                <p className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
                    {error ?? ui("Područje nije pronađeno.")}
                </p>
                <Link to="/nase-malo-misto" className="mt-6 inline-flex font-semibold text-primary-700">
                    {ui("← Sva područja")} </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-12">
            <Link to="/nase-malo-misto" className="text-sm font-semibold text-primary-700 dark:text-blue-300">
                {ui("← Naše malo misto")} </Link>

            <header className="mt-6 overflow-hidden rounded-3xl bg-slate-900 text-white">
                {area.coverImageUrl && (
                    <img src={area.coverImageUrl} alt="" className="h-64 w-full object-cover opacity-80" />
                )}
                <div className="space-y-3 p-8">
                    <h1 className="text-4xl font-bold">{area.name}</h1>
                    {(area.description || area.shortDescription) && (
                        <p className="max-w-3xl text-white/80">{area.description ?? area.shortDescription}</p>
                    )}
                </div>
            </header>
            <ContributionActions area={area.slug} />

            {announcements.length > 0 && (
                <section className="mt-10">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{ui("Aktivne obavijesti")}</h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {announcements.map(item => (
                            <article key={item.id} className={`rounded-2xl border p-5 shadow-sm ${item.importance === 'Urgent' ? 'border-red-300 bg-red-50' : item.importance === 'Important' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {item.importance === 'Urgent' ? ui("Hitno") : item.importance === 'Important' ? ui("Važno") : ui("Obavijest")}
                                </p>
                                <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                                <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
                                <Link to={`/obavijesti/${item.slug}`} className="mt-4 inline-flex text-sm font-semibold text-primary-700">{ui("Detalji →")}</Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {(['Jucer', 'Danas', 'Sutra'] as const).map(perspective => {
                const items = groupedContent[perspective];
                if (items.length === 0) {
                    return null;
                }

                const title = perspective === 'Jucer' ? 'Jučer' : perspective;
                return (
                    <section key={perspective} className="mt-12">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{ui(title)}</h2>
                        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {items.map(item => (
                                <article key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{ui(item.label)}</p>
                                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                                    <p className="mt-2 text-sm text-slate-600">{item.excerpt}</p>
                                    <Link to={item.href} className="mt-4 inline-flex text-sm font-semibold text-primary-700">
                                        {ui("Pročitaj više →")} </Link>
                                </article>
                            ))}
                        </div>
                    </section>
                );
            })}

            {news.length > 0 && (
                <section className="mt-12">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{ui("Najnovije obavijesti")}</h2>
                    <ul className="mt-5 space-y-3">
                        {news.slice(0, 6).map(item => (
                            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                                <Link to={`/novosti/${item.slug}`} className="font-semibold text-slate-900 hover:text-primary-700">
                                    {item.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {blogPosts.length > 0 && (
                <section className="mt-12">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{ui("Priče")}</h2>
                    <Link to={`/blog?area=${encodeURIComponent(area.slug)}`} className="mt-2 inline-flex text-sm font-semibold text-blue-700">{ui("Sve priče ovog područja →")}</Link>
                    <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {blogPosts.map(post => (
                            <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                {post.heroImageUrl && <img src={post.heroImageUrl} alt="" className="h-40 w-full object-cover" />}
                                <div className="p-5">
                                    <h3 className="text-lg font-semibold text-slate-900">{post.title}</h3>
                                    <p className="mt-2 text-sm text-slate-600">{post.excerpt}</p>
                                    <Link to={`/blog/${post.slug}`} className="mt-4 inline-flex text-sm font-semibold text-primary-700">{ui("Pročitaj priču →")}</Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {albums.length > 0 && (
                <section className="mt-12">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{ui("Galerije")}</h2>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {albums.map(album => (
                            <Link
                                key={album.id}
                                to={`/galerija/${album.id}`}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1"
                            >
                                <h3 className="font-semibold text-slate-900">{album.title}</h3>
                                {album.description && <p className="mt-2 text-sm text-slate-600">{album.description}</p>}
                                <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                                    {album.imageCount}  {ui("fotografija")} </p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {news.length === 0 && albums.length === 0 && announcements.length === 0 && blogPosts.length === 0 && (
                <p className="mt-12 text-center text-slate-600 dark:text-white/70">
                    {ui("Za ovo područje još nema objavljenog sadržaja.")} </p>
            )}
            <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 dark:border-white/10">
                <AreaContributionLink slug={area.slug} />
                <p className="text-sm text-slate-600 dark:text-slate-400">{ui("Priče, obavijesti i galerije ovog područja. Jučer je baština, Danas aktualni život, a Sutra planovi.")}</p>
            </div>
        </div>
    );
}
