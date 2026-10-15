import InlineImagePicker from '@/components/common/InlineImagePicker';
import { prepareImageUpload } from '@/lib/inline-image-upload';
import TagPicker from '@/components/common/TagPicker';
import TranslationEditor from '@/components/common/LazyTranslationEditor';
import type { ContentTranslation, TranslationEdit } from '@/lib/content-translations';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { ModerationHistory } from '@/components/common/EditorialPanel';
import PublicationHelp from '@/components/common/PublicationHelp';
import SlugField from '@/components/common/SlugField';
import type { ContentFormContext } from '@/lib/content-form-context';
import React, { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createNews, fetchNewsDetail, updateNews } from '@/lib/news-api';
import { fetchGalleryAlbumsPage, fetchGalleryItemsPage } from '@/lib/gallery-api';
import PagedReferenceSelect, { type ReferenceSearch } from '@/components/common/PagedReferenceSelect';
import { fetchAreas, fetchTags } from '@/lib/classification-api';
import type { Area, ContentTimePerspective, Tag } from '@/lib/types';

const loadPublicAlbums = (options: ReferenceSearch) => fetchGalleryAlbumsPage({ ...options, includeUnpublished: false });
const loadPublicImages = (options: ReferenceSearch) => fetchGalleryItemsPage({ ...options, imagesOnly: true });

interface FormState {
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    publishedAt: string;
    isFeatured: boolean;
    heroImageUrl: string;
    source: string;
    galleryAlbumId: string;
    galleryImageId: string;
    areaId: string;
    timePerspective: '' | ContentTimePerspective;
    tagIds: string[];
}

const initialState: FormState = {
    title: '',
    slug: '',
    excerpt: '',
    body: '',
    publishedAt: '',
    isFeatured: false,
    heroImageUrl: '',
    source: '',
    galleryAlbumId: '',
    galleryImageId: '',
    areaId: '',
    timePerspective: '',
    tagIds: [],
};

export default function PortalNewsForm({ initialAreaId, initialTagIds, initialPerspective, returnTo, onCreated }: ContentFormContext = {}) {
    const { ui } = useUiTranslation();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);
    const { getAccessToken, hasRole } = useAuth();
    const canManage = hasRole('Administrator') || hasRole('SuperUser');
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [savedTranslations, setSavedTranslations] = useState<ContentTranslation[]>([]);
    const [translationEdits, setTranslationEdits] = useState<TranslationEdit[]>([]);
    const [translationBusy, setTranslationBusy] = useState(false);
    const [tagBusy, setTagBusy] = useState(false);
    const [form, setForm] = useState<FormState>(() => ({ ...initialState, areaId: initialAreaId ? String(initialAreaId) : '', tagIds: initialTagIds?.map(String) ?? [], timePerspective: initialPerspective ?? '' }));
    const [loading, setLoading] = useState(isEdit);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [areas, setAreas] = useState<Area[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [classificationError, setClassificationError] = useState<string | null>(null);
    const [rowVersion, setRowVersion] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(true);
    const [moderationFeedback, setModerationFeedback] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        Promise.all([fetchAreas(), fetchTags()])
            .then(([areaResult, tagResult]) => {
                if (active) {
                    setAreas(areaResult);
                    setTags(tagResult);
                }
            })
            .catch(err => {
                if (active) {
                    setClassificationError(
                        err instanceof Error ? err.message : 'Područja i oznake se ne mogu učitati.'
                    );
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!isEdit || !id) {
            return;
        }

        let active = true;

        const load = async () => {
            try {
                const token = await getAccessToken();
                if (!token) {
                    setError('Sesija je istekla. Prijavite se ponovno.');
                    return;
                }

                const detail = await fetchNewsDetail(id, { authorization: token, includeUnpublished: true });
                if (!active) {
                    return;
                }

                setSavedTranslations(detail.translations ?? []);

                setTranslationEdits([]);

                setForm({
                        title: detail.title,
                    slug: detail.slug,
                    excerpt: detail.excerpt,
                    body: detail.body,
                    publishedAt: detail.publishedAt ? detail.publishedAt.substring(0, 10) : '',
                    isFeatured: detail.isFeatured,
                    heroImageUrl: detail.heroImageUrl ?? '',
                    source: detail.source ?? '',
                    galleryAlbumId: detail.galleryAlbumId ? String(detail.galleryAlbumId) : '',
                    galleryImageId: detail.galleryImageId ? String(detail.galleryImageId) : '',
                    areaId: detail.area ? String(detail.area.id) : '',
                    timePerspective: detail.timePerspective ?? '',
                    tagIds: detail.tags.map(tag => String(tag.id)),
                });
                setRowVersion(detail.rowVersion);
                setCanEdit(detail.canEdit);
                setModerationFeedback(detail.latestModerationComment ?? null);
            } catch (err) {
                if (active) {
                    const message =
                        err instanceof Error
                            ? err.message
                            : 'Neuspješno učitavanje obavijesti.';
                    setError(message);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            active = false;
        };
    }, [getAccessToken, id, isEdit]);

    const handleChange =
        (field: keyof FormState) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const value =
                event.target.type === 'checkbox'
                    ? (event.target as HTMLInputElement).checked
                    : event.target.value;
            setForm(prev => ({ ...prev, [field]: value }));
        };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (translationBusy || tagBusy || submitting) return;
        setError(null);
        setSubmitting(true);

        try {
            const token = await getAccessToken();
            if (!token) {
                setError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            const imageUpload = await prepareImageUpload(imageFile);
            const payload = {
                ...(imageUpload ? { imageUpload } : {}),
                translations: translationEdits,
                title: form.title,
                slug: form.slug || undefined,
                excerpt: form.excerpt,
                body: form.body,
                publishedAt: canManage && form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
                isFeatured: canManage && form.isFeatured,
                heroImageUrl: form.heroImageUrl || undefined,
                source: form.source || undefined,
                galleryAlbumId: form.galleryAlbumId ? Number.parseInt(form.galleryAlbumId, 10) : undefined,
                galleryImageId: form.galleryImageId ? Number.parseInt(form.galleryImageId, 10) : undefined,
                areaId: form.areaId ? Number.parseInt(form.areaId, 10) : undefined,
                timePerspective: form.timePerspective || undefined,
                tagIds: form.tagIds.map(value => Number.parseInt(value, 10)),
                rowVersion: isEdit ? rowVersion : null,
            };

            if (isEdit && id) {
                await updateNews(Number(id), payload, token);
            } else {
                const created = await createNews(payload, token);
                if (onCreated) { onCreated(created); return; }
            }

            navigate('..');
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Spremanje nije uspjelo.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <p className="text-sm text-slate-500">{t('common.loading', 'Ucitavanje...')}</p>;
    }

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                    {isEdit ? t('news.form.title.edit', 'Uredi obavijest') : t('news.form.title.new', 'Nova obavijest')}
                </h2>
                <button
                    type="button"
                    onClick={() => navigate(returnTo ?? '..')}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {t('portal.userForm.back', 'Nazad')}
                </button>
            </div>

            {error && <p className="text-sm text-red-600">{ui(error)}</p>}
            <PublicationHelp />
            {isEdit && id && <ModerationHistory type="News" id={Number(id)} />}
            {isEdit && <p className="text-sm text-slate-500">{ui("Spremanje izmjena vraća sadržaj u nacrt i zahtijeva ponovni pregled ili izričitu administratorsku objavu.")}</p>}
            {isEdit && !canEdit && <p className="text-sm text-amber-700">{ui("Sadržaj je otvoren samo za pregled. Odluku donesite u moderatorskom redu.")}</p>}
            {moderationFeedback && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>{ui("Napomena moderatora:")}</strong> {moderationFeedback}</p>}

            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{t('news.form.field.title', 'Naslov *')}</span>
                    <input
                        type="text"
                        value={form.title}
                        onChange={handleChange('title')}
                        required
                        className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                </label>
                <SlugField value={form.slug} onChange={slug => setForm(current => ({ ...current, slug }))} />
                <label className="flex flex-col text-sm md:col-span-2">
                    <span className="font-semibold text-slate-600">
                        {t('news.form.field.excerpt', 'Kratki opis *')}
                    </span>
                    <textarea
                        value={form.excerpt}
                        onChange={handleChange('excerpt')}
                        required
                        rows={3}
                        className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                </label>
                <label className="flex flex-col text-sm md:col-span-2">
                    <span className="font-semibold text-slate-600">{t('news.form.field.body', 'Sadrzaj *')}</span>
                    <textarea
                        value={form.body}
                        onChange={handleChange('body')}
                        required
                        rows={10}
                        className="mt-1 rounded border border-slate-300 p-2 font-mono focus:border-blue-500 focus:outline-none"
                    />
                </label>
                {canManage && <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">
                        {t('news.form.field.publishedAt', 'Datum objave')}
                    </span>
                    <input
                        type="date"
                        value={form.publishedAt}
                        onChange={handleChange('publishedAt')}
                        className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                </label>}
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{t('news.form.field.source', 'Izvor')}</span>
                    <input
                        type="text"
                        value={form.source}
                        onChange={handleChange('source')}
                        className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                </label>
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Glavno područje")}</span>
                    <select
                        value={form.areaId}
                        onChange={handleChange('areaId')}
                        className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">{ui("-- Bez područja --")}</option>
                        {areas.map(area => (
                            <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Jučer – Danas – Sutra")}</span>
                    <select
                        value={form.timePerspective}
                        onChange={handleChange('timePerspective')}
                        className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">{ui("-- Bez perspektive --")}</option>
                        <option value="Jucer">{ui("Jučer")}</option>
                        <option value="Danas">{ui("Danas")}</option>
                        <option value="Sutra">{ui("Sutra")}</option>
                    </select>
                </label>
                <div className="md:col-span-2">
                    <TagPicker tags={tags} selectedIds={form.tagIds} onChange={ids => setForm(current => ({ ...current, tagIds: ids }))}
                    onCreated={tag => setTags(current => [...current, tag])} onBusyChange={setTagBusy}
                    disabled={translationBusy || submitting || !canEdit} />
                    {classificationError && <p className="mt-1 text-xs text-red-600">{ui(classificationError)}</p>}
                </div>
                <div className="md:col-span-2"><InlineImagePicker file={imageFile} onChange={setImageFile} currentUrl={form.heroImageUrl} disabled={submitting || !canEdit} /></div>
                <details className="md:col-span-2"><summary className="cursor-pointer text-sm">{ui("Postojeća fotografija ili poveznica")}</summary>
                <div className="flex flex-col gap-1 text-sm md:col-span-2">
                    <PagedReferenceSelect label={ui("Album galerije")} value={form.galleryAlbumId} loadPage={loadPublicAlbums} disabled={translationBusy || tagBusy || submitting || !canEdit}
                        onChange={value => setForm(prev => ({ ...prev, galleryAlbumId: value }))} />
                    <button type="button" onClick={() => navigate('/portal/gallery/albums/new')} className="self-start rounded border px-3 py-2">{ui("Novi album")}</button>
                    {form.galleryAlbumId && <button type="button" onClick={() => navigate(`/portal/gallery/${form.galleryAlbumId}`)} className="self-start text-blue-600 underline">{ui("Otvori povezani album")}</button>}
                    <PagedReferenceSelect label={ui("Slika iz galerije")} value={form.galleryImageId} loadPage={loadPublicImages} disabled={translationBusy || tagBusy || submitting || !canEdit}
                        onChange={(value, item) => setForm(prev => ({ ...prev, galleryImageId: value, galleryAlbumId: item ? String(item.albumId) : prev.galleryAlbumId }))} />
                </div>
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{t('news.form.field.hero', 'Naslovna slika (URL)')}</span>
                    <input
                        type="text"
                        value={form.heroImageUrl}
                        onChange={handleChange('heroImageUrl')}
                        className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                    />
                </label>
                </details>
                {canManage && <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.isFeatured}
                        onChange={handleChange('isFeatured')}
                        className="h-4 w-4"
                    />
                    <span className="font-semibold text-slate-600">
                        {t('news.form.field.featured', 'Istaknuta objava')}
                    </span>
                </label>}
            </div>

            <TranslationEditor source={{ title: form.title, excerpt: form.excerpt, body: form.body }} saved={savedTranslations} edits={translationEdits} onChange={setTranslationEdits} onBusyChange={setTranslationBusy} disabled={translationBusy || tagBusy || submitting || !canEdit} />

            <button
                type="submit"
                disabled={translationBusy || tagBusy || submitting || (isEdit && !canEdit)}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
                {submitting ? t('portal.userForm.saving', 'Spremanje...') : t('news.form.submit', 'Spremi obavijest')}
            </button>
        </form>
    );
}
