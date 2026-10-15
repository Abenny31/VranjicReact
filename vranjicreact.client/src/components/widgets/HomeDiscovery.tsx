import { useUiTranslation } from '@/hooks/useUiTranslation';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/api-client';
import type { ContentTimePerspective, HomeResponse } from '@/lib/types';

interface HomeDiscoveryProps {
    response: HomeResponse | null;
    loading: boolean;
    error: string | null;
}

const perspectives: Array<{ value: ContentTimePerspective; title: string; description: string }> = [
    { value: 'Jucer', title: 'Jučer', description: 'Povijest, baština i sjećanja.' },
    { value: 'Danas', title: 'Danas', description: 'Današnji život i aktualne priče.' },
    { value: 'Sutra', title: 'Sutra', description: 'Planovi, projekti i ideje.' },
];

export default function HomeDiscovery({ response, loading, error }: HomeDiscoveryProps) {
    const { ui } = useUiTranslation();
    if (loading || error || !response) {
        return null;
    }

    return (
        <>
            {response.importantAnnouncements.length > 0 && (
                <section className="border-y border-amber-200 bg-amber-50 py-10 dark:border-amber-500/20 dark:bg-amber-950/20">
                    <div className="mx-auto max-w-6xl px-4">
                        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">{ui("Važne informacije")}</p>
                                <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{ui("Obavijesti")}</h2>
                            </div>
                            <Link to="/aktualno?kind=Announcement" className="text-sm font-semibold text-primary-700 dark:text-blue-300">{ui("Sve obavijesti →")}</Link>
                        </header>
                        <div className="grid gap-5 md:grid-cols-3">
                            {response.importantAnnouncements.map(item => (
                                <article key={item.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                        {item.importance === 'Urgent' ? ui("Hitno") : ui("Važno")}
                                        {item.area ? ` · ${item.area.name}` : ''}
                                    </p>
                                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                                    <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
                                    <Link to={`/obavijesti/${item.slug}`} className="mt-4 inline-flex text-sm font-semibold text-primary-700">{ui("Detalji →")}</Link>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="py-14 dark:bg-slate-950">
                <div className="mx-auto max-w-6xl px-4">
                    <header className="mb-8">
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">{ui("Vranjic kroz vrijeme")}</p>
                        <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{ui("Jučer – Danas – Sutra")}</h2>
                    </header>
                    <div className="grid gap-6 md:grid-cols-3">
                        {perspectives.map(perspective => {
                            const newsItems = response.latestNews.filter(item => item.timePerspective === perspective.value);
                            const blogItems = response.latestBlogPosts.filter(item => item.timePerspective === perspective.value);
                            return (
                                <div key={perspective.value} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{ui(perspective.title)}</h3>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-white/60">{ui(perspective.description)}</p>
                                    {newsItems.length === 0 && blogItems.length === 0 ? (
                                        <p className="mt-5 text-sm text-slate-500">{ui("Sadržaj je u pripremi.")}</p>
                                    ) : (
                                        <ul className="mt-5 space-y-3">
                                            {newsItems.slice(0, 2).map(item => (
                                                <li key={`news-${item.id}`}>
                                                    <Link to={`/novosti/${item.slug}`} className="font-semibold text-primary-700 hover:text-primary-900 dark:text-blue-300">
                                                        {item.title}
                                                    </Link>
                                                </li>
                                            ))}
                                            {blogItems.slice(0, 2).map(item => (
                                                <li key={`blog-${item.id}`}>
                                                    <Link to={`/blog/${item.slug}`} className="font-semibold text-primary-700 hover:text-primary-900 dark:text-blue-300">
                                                        {item.title}
                                                    </Link>
                                                    <span className="ml-2 text-xs text-slate-400">{ui("priča")}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-primary-50 py-14 dark:bg-slate-900">
                <div className="mx-auto max-w-6xl px-4">
                    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">{ui("Ljudi i mjesta")}</p>
                            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{ui("Naše malo misto")}</h2>
                        </div>
                        <Link to="/nase-malo-misto?all=1" className="text-sm font-semibold text-primary-700 dark:text-blue-300">{ui("Prikaži sva područja →")}</Link>
                    </header>
                    {response.areas.length === 0 ? (
                        <p className="rounded-2xl bg-white p-6 text-center text-slate-500">{ui("Područja su u pripremi.")}</p>
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {response.areas.map(area => (
                                <Link key={area.id} to={`/nase-malo-misto/${area.slug}`} className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm transition hover:-translate-y-1">
                                    {area.coverImageUrl && <img src={area.coverImageUrl} alt="" loading="lazy" className="h-40 w-full object-cover" />}
                                    <div className="p-5">
                                        <h3 className="text-lg font-semibold text-slate-900">{area.name}</h3>
                                        {area.shortDescription && <p className="mt-2 text-sm text-slate-600">{area.shortDescription}</p>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {response.latestBlogPosts.length > 0 && (
                <section className="py-14 dark:bg-slate-950">
                    <div className="mx-auto max-w-6xl px-4">
                        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">{ui("Sjećanja i baština")}</p>
                                <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{ui("Priče iz Vranjica")}</h2>
                            </div>
                            <Link to="/blog" className="text-sm font-semibold text-primary-700 dark:text-blue-300">{ui("Sve priče →")}</Link>
                        </header>
                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {response.latestBlogPosts.slice(0, 3).map(post => (
                                <Link key={post.id} to={`/blog/${post.slug}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1">
                                    {post.heroImageUrl && <img src={post.heroImageUrl} alt="" loading="lazy" className="h-44 w-full object-cover" />}
                                    <div className="p-5">
                                        <h3 className="text-lg font-semibold text-slate-900">{post.title}</h3>
                                        <p className="mt-2 text-sm text-slate-600">{post.excerpt}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="py-14 dark:bg-slate-950">
                <div className="mx-auto max-w-6xl px-4">
                    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">{ui("Izdvojene galerije")}</h2>
                        <Link to="/galerija" className="text-sm font-semibold text-primary-700 dark:text-blue-300">{ui("Sve galerije →")}</Link>
                    </header>
                    {response.galleryHighlights.length === 0 ? (
                        <p className="text-center text-slate-500">{ui("Galerije su u pripremi.")}</p>
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {response.galleryHighlights.slice(0, 6).map(album => (
                                <Link key={album.id} to={`/galerija/${album.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1">
                                    {album.coverImage && (
                                        <img src={`${API_BASE_URL}/api/gallery/${album.coverImage.id}/media`} alt={album.coverImage.title} loading="lazy" className="h-44 w-full object-cover" />
                                    )}
                                    <div className="p-5">
                                        <h3 className="font-semibold text-slate-900">{album.title}</h3>
                                        <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{album.imageCount}  {ui("fotografija")}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
