import TagPicker from '@/components/common/TagPicker';
import TranslationEditor from '@/components/common/LazyTranslationEditor';
import type { ContentTranslation, TranslationEdit } from '@/lib/content-translations';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
    createAnnouncement,
    fetchAnnouncementDetail,
    updateAnnouncement,
} from '@/lib/announcements-api';
import { fetchAreas, fetchTags } from '@/lib/classification-api';
import { CONTENT_MANAGE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import type { AnnouncementImportance, Area, Tag } from '@/lib/types';
import type { AnnouncementDetail } from '@/lib/types';
import EditorialPanel from '@/components/common/EditorialPanel';
import PublicationHelp from '@/components/common/PublicationHelp';
import SlugField from '@/components/common/SlugField';
import type { ContentFormContext } from '@/lib/content-form-context';

interface FormState {
    title: string;
    slug: string;
    summary: string;
    body: string;
    startsAt: string;
    expiresAt: string;
    publishedAt: string;
    importance: AnnouncementImportance;
    actionLabel: string;
    actionUrl: string;
    areaId: string;
    tagIds: string[];
}

function toLocalInput(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

const initialState: FormState = {
    title: '',
    slug: '',
    summary: '',
    body: '',
    startsAt: toLocalInput(new Date()),
    expiresAt: '',
    publishedAt: '',
    importance: 'Normal',
    actionLabel: '',
    actionUrl: '',
    areaId: '',
    tagIds: [],
};

export default function PortalAnnouncementForm({ initialAreaId, initialTagIds, returnTo, onCreated }: ContentFormContext = {}) {
    const { ui } = useUiTranslation();
    const { id } = useParams<{ id?: string }>();
    const isEdit = Boolean(id);
    const { getAccessToken, hasRole } = useAuth();
    const navigate = useNavigate();
    const canManage = hasAnyRole(hasRole, CONTENT_MANAGE_ROLES);
    const [savedTranslations, setSavedTranslations] = useState<ContentTranslation[]>([]);
    const [translationEdits, setTranslationEdits] = useState<TranslationEdit[]>([]);
    const [translationBusy, setTranslationBusy] = useState(false);
    const [tagBusy, setTagBusy] = useState(false);
    const [form, setForm] = useState<FormState>(() => ({ ...initialState, areaId: initialAreaId ? String(initialAreaId) : '', tagIds: initialTagIds?.map(String) ?? [] }));
    const [detail, setDetail] = useState<AnnouncementDetail | null>(null);
    const [areas, setAreas] = useState<Area[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'Područja i oznake se ne mogu učitati.');
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
                    throw new Error('Sesija je istekla. Prijavite se ponovno.');
                }

                const item = await fetchAnnouncementDetail(id, {
                    authorization: token,
                    includeUnpublished: true,
                });
                if (active) {
                    setDetail(item);
                    setSavedTranslations(item.translations ?? []);
                    setTranslationEdits([]);
                    setForm({
                        title: item.title,
                        slug: item.slug,
                        summary: item.summary,
                        body: item.body,
                        startsAt: toLocalInput(item.startsAt),
                        expiresAt: item.expiresAt ? toLocalInput(item.expiresAt) : '',
                        publishedAt: item.publishedAt ? toLocalInput(item.publishedAt) : '',
                        importance: item.importance,
                        actionLabel: item.actionLabel ?? '',
                        actionUrl: item.actionUrl ?? '',
                        areaId: item.area ? String(item.area.id) : '',
                        tagIds: item.tags.map(tag => String(tag.id)),
                    });
                }
            } catch (reason) {
                if (active) {
                    setError(reason instanceof Error ? reason.message : 'Obavijest se ne može učitati.');
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
            setForm(current => ({ ...current, [field]: event.target.value }));
        };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (translationBusy || tagBusy || submitting) return;
        setSubmitting(true);
        setError(null);

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('Sesija je istekla. Prijavite se ponovno.');
            }

            const payload = {
                translations: translationEdits,
                title: form.title,
                slug: form.slug || undefined,
                summary: form.summary,
                body: form.body,
                startsAt: new Date(form.startsAt).toISOString(),
                expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                publishedAt: canManage && form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
                importance: form.importance,
                actionLabel: form.actionLabel || null,
                actionUrl: form.actionUrl || null,
                areaId: form.areaId ? Number.parseInt(form.areaId, 10) : null,
                tagIds: form.tagIds.map(value => Number.parseInt(value, 10)),
                rowVersion: detail?.rowVersion,
            };

            if (isEdit && id) {
                await updateAnnouncement(Number.parseInt(id, 10), payload, token);
            } else {
                const created = await createAnnouncement(payload, token);
                if (onCreated) { onCreated(created); return; }
            }
            navigate('/portal/updates');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Spremanje obavijesti nije uspjelo.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <p className="text-sm text-slate-500">{ui("Učitavanje...")}</p>;
    }

    return (
        <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-800">{isEdit ? ui("Uredi obavijest") : ui("Nova obavijest s rokom")}</h2>
                <button type="button" onClick={() => navigate(returnTo ?? '..')} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
                    {ui("Nazad")} </button>
            </div>

            {error && <p className="text-sm text-red-600">{ui(error)}</p>}
            <PublicationHelp />
            {detail && <EditorialPanel type="Announcement" id={detail.id} status={detail.editorialStatus} rowVersion={detail.rowVersion} canSubmit={detail.canSubmit} onChanged={() => navigate('/portal/updates')} />}
            <p className="text-sm text-slate-500">{isEdit ? ui("Spremanje izmjena vraća sadržaj u nacrt. Nakon toga pošaljite na pregled ili izričito objavite.") : ui("Bez datuma objave obavijest se sprema kao nacrt. Nakon spremanja pošaljite je na pregled ili je objavite iz popisa obavijesti.")}</p>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Naslov *")}</span>
                    <input required value={form.title} onChange={handleChange('title')} className="mt-1 rounded border border-slate-300 p-2" />
                </label>
                <SlugField value={form.slug} onChange={slug => setForm(current => ({ ...current, slug }))} />
            </div>

            <label className="flex flex-col text-sm">
                <span className="font-semibold text-slate-600">{ui("Sažetak *")}</span>
                <textarea required rows={3} value={form.summary} onChange={handleChange('summary')} className="mt-1 rounded border border-slate-300 p-2" />
            </label>

            <label className="flex flex-col text-sm">
                <span className="font-semibold text-slate-600">{ui("Sadržaj *")}</span>
                <textarea required rows={10} value={form.body} onChange={handleChange('body')} className="mt-1 rounded border border-slate-300 p-2" />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Početak prikaza *")}</span>
                    <input type="datetime-local" required value={form.startsAt} onChange={handleChange('startsAt')} className="mt-1 rounded border border-slate-300 p-2" />
                </label>
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Istek")}</span>
                    <input type="datetime-local" value={form.expiresAt} onChange={handleChange('expiresAt')} className="mt-1 rounded border border-slate-300 p-2" />
                </label>
                {canManage && !isEdit && (
                    <label className="flex flex-col text-sm">
                        <span className="font-semibold text-slate-600">{ui("Datum objave")}</span>
                        <input type="datetime-local" value={form.publishedAt} onChange={handleChange('publishedAt')} className="mt-1 rounded border border-slate-300 p-2" />
                    </label>
                )}
            </div>

            {!canManage && <p className="text-sm text-slate-500">{ui("Obavijest će biti spremljena kao nacrt za pregled administratora.")}</p>}

            <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Važnost *")}</span>
                    <select value={form.importance} onChange={handleChange('importance')} className="mt-1 rounded border border-slate-300 p-2">
                        <option value="Normal">{ui("Normalno")}</option>
                        <option value="Important">{ui("Važno")}</option>
                        <option value="Urgent">{ui("Hitno")}</option>
                    </select>
                </label>
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Područje")}</span>
                    <select value={form.areaId} onChange={handleChange('areaId')} className="mt-1 rounded border border-slate-300 p-2">
                        <option value="">{ui("Bez područja")}</option>
                        {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                </label>
                <TagPicker tags={tags} selectedIds={form.tagIds} onChange={ids => setForm(current => ({ ...current, tagIds: ids }))}
                    onCreated={tag => setTags(current => [...current, tag])} onBusyChange={setTagBusy}
                    disabled={translationBusy || submitting || (isEdit && !detail?.canEdit)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Naziv akcije")}</span>
                    <input value={form.actionLabel} onChange={handleChange('actionLabel')} placeholder={ui("Prijavi se")} className="mt-1 rounded border border-slate-300 p-2" />
                </label>
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Poveznica akcije")}</span>
                    <input value={form.actionUrl} onChange={handleChange('actionUrl')} placeholder={ui("/kontakt ili https://...")} className="mt-1 rounded border border-slate-300 p-2" />
                </label>
            </div>

            <TranslationEditor source={{ title: form.title, summary: form.summary, body: form.body, actionLabel: form.actionLabel }} saved={savedTranslations} edits={translationEdits} onChange={setTranslationEdits} onBusyChange={setTranslationBusy} disabled={translationBusy || tagBusy || submitting || (isEdit && !detail?.canEdit)} />

            <button disabled={translationBusy || tagBusy || submitting || (isEdit && !detail?.canEdit)} className="rounded bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {submitting ? ui("Spremanje...") : ui("Spremi obavijest")}
            </button>
        </form>
    );
}
