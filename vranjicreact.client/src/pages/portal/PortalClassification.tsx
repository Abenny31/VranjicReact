import TranslationEditor from '@/components/common/LazyTranslationEditor';
import type { ContentTranslation, TranslationEdit } from '@/lib/content-translations';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SlugField from '@/components/common/SlugField';
import {
    createArea,
    createTag,
    deleteArea,
    deleteTag,
    fetchAdminAreas,
    fetchAdminTags,
    updateArea,
    updateTag,
} from '@/lib/classification-api';
import type { Area, Tag } from '@/lib/types';

interface AreaFormState {
    id: number | null;
    name: string;
    slug: string;
    shortDescription: string;
    description: string;
    coverImageUrl: string;
    sortOrder: string;
    isActive: boolean;
}

interface TagFormState {
    id: number | null;
    name: string;
    slug: string;
    isActive: boolean;
}

const emptyArea: AreaFormState = {
    id: null,
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    coverImageUrl: '',
    sortOrder: '0',
    isActive: true,
};

const emptyTag: TagFormState = {
    id: null,
    name: '',
    slug: '',
    isActive: true,
};

export default function PortalClassification({ section }: { section: 'areas' | 'tags' }) {
    const { ui } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const [areas, setAreas] = useState<Area[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [areaTranslations, setAreaTranslations] = useState<ContentTranslation[]>([]);
    const [areaEdits, setAreaEdits] = useState<TranslationEdit[]>([]);
    const [areaTranslationBusy, setAreaTranslationBusy] = useState(false);
    const [areaForm, setAreaForm] = useState<AreaFormState>(emptyArea);
    const [tagTranslations, setTagTranslations] = useState<ContentTranslation[]>([]);
    const [tagEdits, setTagEdits] = useState<TranslationEdit[]>([]);
    const [tagTranslationBusy, setTagTranslationBusy] = useState(false);
    const [tagForm, setTagForm] = useState<TagFormState>(emptyTag);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [areaSaved, setAreaSaved] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('Sesija je istekla. Prijavite se ponovno.');
            }

            if (section === 'areas') {
                setAreas(await fetchAdminAreas(token));
            } else {
                setTags(await fetchAdminTags(token));
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Šifrarnici se ne mogu učitati.');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken, section]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleAreaSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (areaTranslationBusy || tagTranslationBusy) return;
        setSubmitting(true);
        setError(null);
        setAreaSaved(false);

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('Sesija je istekla. Prijavite se ponovno.');
            }

            const payload = {
                translations: areaEdits,
                name: areaForm.name.trim(),
                slug: areaForm.slug.trim() || undefined,
                shortDescription: areaForm.shortDescription.trim() || undefined,
                description: areaForm.description.trim() || undefined,
                coverImageUrl: areaForm.coverImageUrl.trim() || undefined,
                sortOrder: Number.parseInt(areaForm.sortOrder, 10) || 0,
                isActive: areaForm.isActive,
            };

            if (areaForm.id === null) {
                await createArea(payload, token);
            } else {
                await updateArea(areaForm.id, payload, token);
            }

            setAreaForm(emptyArea); setAreaTranslations([]); setAreaEdits([]);
            await load();
            setAreaSaved(true);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Područje nije spremljeno.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleTagSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (areaTranslationBusy || tagTranslationBusy) return;
        setSubmitting(true);
        setError(null);

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('Sesija je istekla. Prijavite se ponovno.');
            }

            const payload = {
                translations: tagEdits,
                name: tagForm.name.trim(),
                slug: tagForm.slug.trim() || undefined,
                isActive: tagForm.isActive,
            };

            if (tagForm.id === null) {
                await createTag(payload, token);
            } else {
                await updateTag(tagForm.id, payload, token);
            }

            setTagForm(emptyTag); setTagTranslations([]); setTagEdits([]);
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Oznaka nije spremljena.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteArea = async (area: Area) => {
        if (!window.confirm(ui('Obrisati područje “{name}”?', { name: area.name }))) {
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('Sesija je istekla. Prijavite se ponovno.');
            }
            await deleteArea(area.id, token);
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Područje nije obrisano.');
        }
    };

    const handleDeleteTag = async (tag: Tag) => {
        if (!window.confirm(ui('Obrisati oznaku “{name}”?', { name: tag.name }))) {
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('Sesija je istekla. Prijavite se ponovno.');
            }
            await deleteTag(tag.id, token);
            await load();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Oznaka nije obrisana.');
        }
    };

    if (loading) {
        return <p className="text-sm text-slate-500">{ui("Učitavanje šifrarnika...")}</p>;
    }

    return (
        <div className="space-y-10">
            <div>
                <h2 className="text-xl font-semibold text-slate-800">{ui(section === 'areas' ? 'Područja' : 'Oznake')}</h2>
                <p className="mt-1 text-sm text-slate-500">
                    {ui(section === 'areas' ? 'Područja grade navigaciju “Naše malo misto”.' : 'Oznake služe dodatnom filtriranju sadržaja.')} </p>
            </div>

            {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{ui(error)}</p>}
            {areaSaved && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ui("Područje je spremljeno. Navigacija koristi spremljeni redoslijed aktivnih područja.")}</p>}

            {section === 'areas' && <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
                <div className="overflow-x-auto">
                    <h3 className="mb-3 text-lg font-semibold text-slate-800">{ui("Područja")}</h3>
                    <p className="mb-3 text-sm text-slate-500">{ui("Za promjenu rasporeda odaberite Uredi uz područje i postavite redoslijed u navigaciji. Prikazuju se samo aktivna područja.")}</p>
                    {areas.length === 0 ? (
                        <p className="text-sm text-slate-500">{ui("Još nema područja.")}</p>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 py-2 text-left">{ui("Naziv")}</th>
                                    <th className="px-3 py-2 text-left">{ui("Redoslijed u navigaciji")}</th>
                                    <th className="px-3 py-2 text-left">{ui("Status")}</th>
                                    <th className="px-3 py-2 text-right">{ui("Radnje")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {areas.map(area => (
                                    <tr key={area.id}>
                                        <td className="px-3 py-2">
                                            <p className="font-semibold text-slate-800">{area.name}</p>
                                            <p className="text-xs text-slate-500">{area.slug}</p>
                                        </td>
                                        <td className="px-3 py-2">{area.sortOrder}</td>
                                        <td className="px-3 py-2">{area.isActive ? ui("Aktivno") : ui("Neaktivno")}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => { setAreaTranslations(area.translations ?? []); setAreaEdits([]); setAreaForm({
                                                        id: area.id,
                                                        name: area.name,
                                                        slug: area.slug,
                                                        shortDescription: area.shortDescription ?? '',
                                                        description: area.description ?? '',
                                                        coverImageUrl: area.coverImageUrl ?? '',
                                                        sortOrder: String(area.sortOrder),
                                                        isActive: area.isActive,
                                                    }); }}
                                                    className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold"
                                                >
                                                    {ui("Uredi")} </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteArea(area)}
                                                    className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600"
                                                >
                                                    {ui("Obriši")} </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <form className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4" onSubmit={handleAreaSubmit}>
                    <h3 className="font-semibold text-slate-800">
                        {areaForm.id === null ? ui("Novo područje") : ui("Uredi područje")}
                    </h3>
                    <label className="block text-sm">
                        <span className="font-semibold text-slate-600">{ui("Naziv *")}</span>
                        <input required value={areaForm.name} onChange={event => setAreaForm(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                    </label>
                    <label className="block text-sm">
                        <span className="font-semibold text-slate-600">{ui("Redoslijed u navigaciji")}</span>
                        <input type="number" step={1} min={-2147483648} max={2147483647} aria-describedby="area-sort-order-help" value={areaForm.sortOrder} onChange={event => setAreaForm(current => ({ ...current, sortOrder: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                    </label>
                    <p id="area-sort-order-help" className="text-xs text-slate-500">{ui("Manji broj prikazuje područje prije ostalih (npr. 0, 1, 2). Za isti broj područja se slažu po nazivu. Nakon promjene kliknite Spremi.")}</p>
                    <SlugField value={areaForm.slug} onChange={slug => setAreaForm(current => ({ ...current, slug }))} />
                    <label className="block text-sm">
                        <span className="font-semibold text-slate-600">{ui("Kratki opis")}</span>
                        <textarea rows={2} value={areaForm.shortDescription} onChange={event => setAreaForm(current => ({ ...current, shortDescription: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                    </label>
                    <label className="block text-sm">
                        <span className="font-semibold text-slate-600">{ui("Opis")}</span>
                        <textarea rows={4} value={areaForm.description} onChange={event => setAreaForm(current => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                    </label>
                    <label className="block text-sm">
                        <span className="font-semibold text-slate-600">{ui("Naslovna fotografija (URL)")}</span>
                        <input type="url" value={areaForm.coverImageUrl} onChange={event => setAreaForm(current => ({ ...current, coverImageUrl: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={areaForm.isActive} onChange={event => setAreaForm(current => ({ ...current, isActive: event.target.checked }))} />
                        {ui("Aktivno područje")} </label>
                    <TranslationEditor key={areaForm.id ?? 'new'} source={{ name: areaForm.name, shortDescription: areaForm.shortDescription, description: areaForm.description }} saved={areaTranslations} edits={areaEdits} onChange={setAreaEdits} onBusyChange={setAreaTranslationBusy} disabled={submitting || areaTranslationBusy || tagTranslationBusy} />

                    <div className="flex gap-2">
                        <button type="submit" disabled={submitting || areaTranslationBusy || tagTranslationBusy} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-blue-300">
                            {submitting ? ui("Spremanje...") : ui("Spremi")}
                        </button>
                        {areaForm.id !== null && (
                            <button type="button" onClick={() => { setAreaForm(emptyArea); setAreaTranslations([]); setAreaEdits([]); }} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold">
                                {ui("Odustani")} </button>
                        )}
                    </div>
                </form>
            </section>}

            {section === 'tags' && <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
                <div>
                    <h3 className="mb-3 text-lg font-semibold text-slate-800">{ui("Oznake")}</h3>
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <div key={tag.id} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
                                <span className={tag.isActive ? 'text-slate-700' : 'text-slate-400'}>{tag.name}</span>
                                <button type="button" onClick={() => { setTagTranslations(tag.translations ?? []); setTagEdits([]); setTagForm({ id: tag.id, name: tag.name, slug: tag.slug, isActive: tag.isActive }); }} className="text-xs font-semibold text-blue-600">{ui("Uredi")}</button>
                                <button type="button" onClick={() => void handleDeleteTag(tag)} className="text-xs font-semibold text-red-600">{ui("Obriši")}</button>
                            </div>
                        ))}
                        {tags.length === 0 && <p className="text-sm text-slate-500">{ui("Još nema oznaka.")}</p>}
                    </div>
                </div>

                <form className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4" onSubmit={handleTagSubmit}>
                    <h3 className="font-semibold text-slate-800">{tagForm.id === null ? ui("Nova oznaka") : ui("Uredi oznaku")}</h3>
                    <label className="block text-sm">
                        <span className="font-semibold text-slate-600">{ui("Naziv *")}</span>
                        <input required value={tagForm.name} onChange={event => setTagForm(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                    </label>
                    <SlugField value={tagForm.slug} onChange={slug => setTagForm(current => ({ ...current, slug }))} />
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={tagForm.isActive} onChange={event => setTagForm(current => ({ ...current, isActive: event.target.checked }))} />
                        {ui("Aktivna oznaka")} </label>
                    <TranslationEditor key={tagForm.id ?? 'new'} source={{ name: tagForm.name }} saved={tagTranslations} edits={tagEdits} onChange={setTagEdits} onBusyChange={setTagTranslationBusy} disabled={submitting || areaTranslationBusy || tagTranslationBusy} />

                    <div className="flex gap-2">
                        <button type="submit" disabled={submitting || areaTranslationBusy || tagTranslationBusy} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-blue-300">
                            {submitting ? ui("Spremanje...") : ui("Spremi")}
                        </button>
                        {tagForm.id !== null && (
                            <button type="button" onClick={() => { setTagForm(emptyTag); setTagTranslations([]); setTagEdits([]); }} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold">
                                {ui("Odustani")} </button>
                        )}
                    </div>
                </form>
            </section>}
        </div>
    );
}
