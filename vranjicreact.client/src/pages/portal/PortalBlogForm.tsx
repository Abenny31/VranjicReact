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
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createBlogPost, fetchBlogPostDetail, updateBlogPost } from '@/lib/blog-api';
import { fetchAreas, fetchTags } from '@/lib/classification-api';
import { originLabels, perspectiveLabels, sourceTypeLabels } from '@/lib/content-labels';
import { CONTENT_MANAGE_ROLES, CONTENT_VERIFY_ROLES, hasAnyRole } from '@/lib/auth-roles';
import type {
    Area,
    ContentOrigin,
    ContentSourceType,
    ContentTimePerspective,
    Tag,
} from '@/lib/types';

interface SourceState {
    key: number;
    title: string;
    author: string;
    year: string;
    type: ContentSourceType;
    url: string;
    note: string;
}

interface FormState {
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    heroImageUrl: string;
    publishedAt: string;
    isFeatured: boolean;
    areaId: string;
    timePerspective: '' | ContentTimePerspective;
    origin: '' | ContentOrigin;
    tagIds: string[];
    sources: SourceState[];
}

function toLocalInput(value: string) {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

const initialState: FormState = {
    title: '',
    slug: '',
    excerpt: '',
    body: '',
    heroImageUrl: '',
    publishedAt: '',
    isFeatured: false,
    areaId: '',
    timePerspective: '',
    origin: '',
    tagIds: [],
    sources: [],
};

export default function PortalBlogForm({ initialAreaId, initialTagIds, initialPerspective, returnTo, onCreated }: ContentFormContext = {}) {
    const { ui } = useUiTranslation();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);
    const { getAccessToken, hasRole } = useAuth();
    const navigate = useNavigate();
    const canManage = hasAnyRole(hasRole, CONTENT_MANAGE_ROLES);
    const canVerify = hasAnyRole(hasRole, CONTENT_VERIFY_ROLES);
    const [savedTranslations, setSavedTranslations] = useState<ContentTranslation[]>([]);
    const [translationEdits, setTranslationEdits] = useState<TranslationEdit[]>([]);
    const [translationBusy, setTranslationBusy] = useState(false);
    const [tagBusy, setTagBusy] = useState(false);
    const [form, setForm] = useState<FormState>(() => ({ ...initialState, areaId: initialAreaId ? String(initialAreaId) : '', tagIds: initialTagIds?.map(String) ?? [], timePerspective: initialPerspective ?? '' }));
    const [areas, setAreas] = useState<Area[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(isEdit);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
            .catch(reason => {
                if (active) setError(reason instanceof Error ? reason.message : 'Područja i oznake se ne mogu učitati.');
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!isEdit || !id) return;
        let active = true;
        const load = async () => {
            try {
                const token = await getAccessToken();
                if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
                const item = await fetchBlogPostDetail(id, { authorization: token, includeUnpublished: true });
                if (!active) return;
                setSavedTranslations(item.translations ?? []);
                setTranslationEdits([]);
                setForm({
                        title: item.title,
                    slug: item.slug,
                    excerpt: item.excerpt,
                    body: item.body,
                    heroImageUrl: item.heroImageUrl ?? '',
                    publishedAt: item.publishedAt ? toLocalInput(item.publishedAt) : '',
                    isFeatured: item.isFeatured,
                    areaId: item.area ? String(item.area.id) : '',
                    timePerspective: item.timePerspective ?? '',
                    origin: item.origin ?? '',
                    tagIds: item.tags.map(tag => String(tag.id)),
                    sources: item.sources.map(source => ({
                        key: source.id,
                        title: source.title,
                        author: source.author ?? '',
                        year: source.year ? String(source.year) : '',
                        type: source.type,
                        url: source.url ?? '',
                        note: source.note ?? '',
                    })),
                });
                setRowVersion(item.rowVersion);
                setCanEdit(item.canEdit);
                setModerationFeedback(item.latestModerationComment ?? null);
            } catch (reason) {
                if (active) setError(reason instanceof Error ? reason.message : 'Priča se ne može učitati.');
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [getAccessToken, id, isEdit]);

    const change =
        (field: keyof FormState) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const value = event.target.type === 'checkbox'
                ? (event.target as HTMLInputElement).checked
                : event.target.value;
            setForm(current => ({ ...current, [field]: value }));
        };

    const addSource = () => {
        setForm(current => ({
            ...current,
            sources: [...current.sources, {
                key: Date.now(),
                title: '',
                author: '',
                year: '',
                type: 'Document',
                url: '',
                note: '',
            }],
        }));
    };

    const changeSource = (key: number, field: keyof Omit<SourceState, 'key'>, value: string) => {
        setForm(current => ({
            ...current,
            sources: current.sources.map(source => source.key === key ? { ...source, [field]: value } : source),
        }));
    };

    const removeSource = (key: number) => {
        setForm(current => ({ ...current, sources: current.sources.filter(source => source.key !== key) }));
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (translationBusy || tagBusy || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            const imageUpload = await prepareImageUpload(imageFile);
            const payload = {
                ...(imageUpload ? { imageUpload } : {}),
                translations: translationEdits,
                title: form.title,
                slug: form.slug || null,
                excerpt: form.excerpt,
                body: form.body,
                heroImageUrl: form.heroImageUrl || null,
                publishedAt: canManage && form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
                isFeatured: canManage && form.isFeatured,
                areaId: form.areaId ? Number.parseInt(form.areaId, 10) : null,
                timePerspective: form.timePerspective || null,
                origin: form.origin || null,
                tagIds: form.tagIds.map(value => Number.parseInt(value, 10)),
                sources: form.sources.map(source => ({
                    title: source.title,
                    author: source.author || null,
                    year: source.year ? Number.parseInt(source.year, 10) : null,
                    type: source.type,
                    url: source.url || null,
                    note: source.note || null,
                })),
                rowVersion: isEdit ? rowVersion : null,
            };

            if (isEdit && id) await updateBlogPost(Number.parseInt(id, 10), payload, token);
            else {
                const created = await createBlogPost(payload, token);
                if (onCreated) { onCreated(created); return; }
            }
            navigate(returnTo ?? '/portal/blog');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Spremanje priče nije uspjelo.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <p className="text-sm text-slate-500">{ui("Učitavanje...")}</p>;

    return (
        <form className="space-y-5" onSubmit={submit}>
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-800">{isEdit ? ui("Uredi priču") : ui("Nova priča")}</h2>
                <button type="button" onClick={() => navigate(returnTo ?? '/portal/blog')} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">{ui("Nazad")}</button>
            </div>
            {error && <p className="text-sm text-red-600">{ui(error)}</p>}
            <PublicationHelp />
            {isEdit && id && <ModerationHistory type="Blog" id={Number(id)} />}
            {isEdit && <p className="text-sm text-slate-500">{ui("Spremanje izmjena vraća sadržaj u nacrt i zahtijeva ponovni pregled ili izričitu administratorsku objavu.")}</p>}
            {isEdit && !canEdit && <p className="text-sm text-amber-700">{ui("Sadržaj je otvoren samo za pregled. Odluku donesite u moderatorskom redu.")}</p>}
            {moderationFeedback && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>{ui("Napomena moderatora:")}</strong> {moderationFeedback}</p>}

            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Naslov *")}</span><input required value={form.title} onChange={change('title')} className="mt-1 rounded border border-slate-300 p-2" /></label>
                <SlugField value={form.slug} onChange={slug => setForm(current => ({ ...current, slug }))} />
            </div>
            <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Sažetak *")}</span><textarea required rows={3} value={form.excerpt} onChange={change('excerpt')} className="mt-1 rounded border border-slate-300 p-2" /></label>
            <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Sadržaj *")}</span><textarea required rows={14} value={form.body} onChange={change('body')} className="mt-1 rounded border border-slate-300 p-2" /></label>
            <InlineImagePicker file={imageFile} onChange={setImageFile} currentUrl={form.heroImageUrl} disabled={submitting || !canEdit} />
            <details><summary className="cursor-pointer text-sm">{ui("Postojeća fotografija ili poveznica")}</summary>
            <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Naslovna fotografija")}</span><input type="text" value={form.heroImageUrl} onChange={change('heroImageUrl')} placeholder={ui("/slike/fotografija.jpg ili https://...")} className="mt-1 rounded border border-slate-300 p-2" /></label></details>

            <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Područje")}</span><select value={form.areaId} onChange={change('areaId')} className="mt-1 rounded border border-slate-300 p-2"><option value="">{ui("Bez područja")}</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
                <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Perspektiva")}</span><select value={form.timePerspective} onChange={change('timePerspective')} className="mt-1 rounded border border-slate-300 p-2"><option value="">{ui("Bez perspektive")}</option>{Object.entries(perspectiveLabels).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
                <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Podrijetlo")}</span><select value={form.origin} onChange={change('origin')} className="mt-1 rounded border border-slate-300 p-2"><option value="">{ui("Nije određeno")}</option>{Object.entries(originLabels).filter(([value]) => value !== 'DocumentedAndVerified' || canVerify).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
            </div>

            <TagPicker tags={tags} selectedIds={form.tagIds} onChange={ids => setForm(current => ({ ...current, tagIds: ids }))}
                    onCreated={tag => setTags(current => [...current, tag])} onBusyChange={setTagBusy}
                    disabled={translationBusy || submitting || !canEdit} />

            {canManage ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col text-sm"><span className="font-semibold text-slate-600">{ui("Datum objave")}</span><input type="datetime-local" value={form.publishedAt} onChange={change('publishedAt')} className="mt-1 rounded border border-slate-300 p-2" /></label>
                    <label className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={form.isFeatured} onChange={change('isFeatured')} />  {ui("Istaknuta priča")}</label>
                </div>
            ) : <p className="text-sm text-slate-500">{ui("Priča će biti spremljena kao nacrt za pregled administratora.")}</p>}

            <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                    <div><h3 className="font-semibold text-slate-800">{ui("Izvori")}</h3><p className="text-xs text-slate-500">{ui("Obvezni su za status „Dokumentirano i provjereno”.")}</p></div>
                    <button type="button" onClick={addSource} className="rounded border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700">{ui("Dodaj izvor")}</button>
                </div>
                {form.sources.map((source, index) => (
                    <div key={source.key} className="space-y-3 rounded-xl bg-slate-50 p-4">
                        <div className="flex justify-between gap-3"><h4 className="font-semibold text-slate-700">{ui("Izvor")} {index + 1}</h4><button type="button" onClick={() => removeSource(source.key)} className="text-sm font-semibold text-red-600">{ui("Ukloni")}</button></div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <input required placeholder={ui("Naslov izvora")} value={source.title} onChange={event => changeSource(source.key, 'title', event.target.value)} className="rounded border border-slate-300 p-2 text-sm" />
                            <input placeholder={ui("Autor")} value={source.author} onChange={event => changeSource(source.key, 'author', event.target.value)} className="rounded border border-slate-300 p-2 text-sm" />
                            <input type="number" min="1" max={new Date().getFullYear() + 1} placeholder={ui("Godina")} value={source.year} onChange={event => changeSource(source.key, 'year', event.target.value)} className="rounded border border-slate-300 p-2 text-sm" />
                            <select value={source.type} onChange={event => changeSource(source.key, 'type', event.target.value)} className="rounded border border-slate-300 p-2 text-sm">{Object.entries(sourceTypeLabels).map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select>
                            <input type="url" placeholder="https://..." value={source.url} onChange={event => changeSource(source.key, 'url', event.target.value)} className="rounded border border-slate-300 p-2 text-sm md:col-span-2" />
                            <textarea placeholder={ui("Napomena")} value={source.note} onChange={event => changeSource(source.key, 'note', event.target.value)} className="rounded border border-slate-300 p-2 text-sm md:col-span-2" />
                        </div>
                    </div>
                ))}
            </section>

            <TranslationEditor source={{ title: form.title, excerpt: form.excerpt, body: form.body }} saved={savedTranslations} edits={translationEdits} onChange={setTranslationEdits} onBusyChange={setTranslationBusy} disabled={translationBusy || tagBusy || submitting || !canEdit} />

            <button disabled={translationBusy || tagBusy || submitting || (isEdit && !canEdit)} className="rounded bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? ui("Spremanje...") : ui("Spremi priču")}</button>
        </form>
    );
}
