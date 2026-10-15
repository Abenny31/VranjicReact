import InlineImagePicker from '@/components/common/InlineImagePicker';
import { prepareImageUpload } from '@/lib/inline-image-upload';
import TagPicker from '@/components/common/TagPicker';
import TranslationEditor from '@/components/common/LazyTranslationEditor';
import type { ContentTranslation, TranslationEdit } from '@/lib/content-translations';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createGalleryAlbum, fetchGalleryAlbum, updateGalleryAlbum } from '@/lib/gallery-api';
import { fetchNewsPage } from '@/lib/news-api';
import PagedReferenceSelect, { type ReferenceSearch } from '@/components/common/PagedReferenceSelect';
import { fetchAreas, fetchTags } from '@/lib/classification-api';
import type { Area, ContentTimePerspective, Tag, GalleryAlbumSummary } from '@/lib/types';
import EditorialPanel from '@/components/common/EditorialPanel';
import PublicationHelp from '@/components/common/PublicationHelp';
import type { ContentFormContext } from '@/lib/content-form-context';

const loadRelatedNews = (options: ReferenceSearch) => fetchNewsPage({ ...options, includeUnpublished: true, unlinkedOnly: true });

export default function PortalGalleryAlbumForm({ initialAreaId, initialTagIds, initialPerspective, returnTo, onCreated }: ContentFormContext = {}) {
    const { ui } = useUiTranslation();
    const { getAccessToken, hasRole } = useAuth();
    const canManage = hasRole('Administrator') || hasRole('SuperUser');
    const [album, setAlbum] = useState<GalleryAlbumSummary | null>(null);
    const [eventDate, setEventDate] = useState('');
    const [photographer, setPhotographer] = useState('');
    const navigate = useNavigate();
    const { albumId } = useParams<{ albumId?: string }>();
    const isEdit = Boolean(albumId);

    const [savedTranslations, setSavedTranslations] = useState<ContentTranslation[]>([]);
    const [translationEdits, setTranslationEdits] = useState<TranslationEdit[]>([]);
    const [translationBusy, setTranslationBusy] = useState(false);
    const [tagBusy, setTagBusy] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [relatedNewsId, setRelatedNewsId] = useState<string>('');
    const [areaId, setAreaId] = useState(initialAreaId ? String(initialAreaId) : '');
    const [timePerspective, setTimePerspective] = useState<'' | ContentTimePerspective>(initialPerspective ?? '');
    const [tagIds, setTagIds] = useState<string[]>(() => initialTagIds?.map(String) ?? []);
    const [areas, setAreas] = useState<Area[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
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
            .catch(err => {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Područja i oznake se ne mogu učitati.');
                }
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!isEdit || !albumId) {
            return;
        }

        let active = true;

        const loadAlbum = async () => {
            try {
                const token = await getAccessToken();
                if (!token) {
                    throw new Error('Sesija je istekla. Prijavite se ponovno.');
                }

                const detail = await fetchGalleryAlbum(Number.parseInt(albumId, 10), token);
                if (active) {
                    setAlbum(detail.album);
                    setEventDate(detail.album.eventDate ?? '');
                    setPhotographer(detail.album.photographer ?? '');
                    setTitle(detail.album.title);
                    setSavedTranslations(detail.album.translations ?? []);
                    setTranslationEdits([]);
                    setDescription(detail.album.description ?? '');
                    setRelatedNewsId(detail.album.relatedNewsId ? String(detail.album.relatedNewsId) : '');
                    setAreaId(detail.album.area ? String(detail.album.area.id) : '');
                    setTimePerspective(detail.album.timePerspective ?? '');
                    setTagIds(detail.album.tags.map(tag => String(tag.id)));
                }
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Album se ne može učitati.');
                }
            }
        };

        void loadAlbum();
        return () => {
            active = false;
        };
    }, [albumId, getAccessToken, isEdit]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (translationBusy || tagBusy || submitting) return;
        setError(null);

        if (!title.trim()) {
            setError('Naslov je obavezan.');
            return;
        }

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
                title: title.trim(),
                description: description.trim() || undefined,
                relatedNewsId: relatedNewsId ? Number.parseInt(relatedNewsId, 10) : undefined,
                areaId: areaId ? Number.parseInt(areaId, 10) : undefined,
                timePerspective: timePerspective || undefined,
                tagIds: tagIds.map(value => Number.parseInt(value, 10)),
                eventDate: eventDate || null,
                photographer: photographer || null,
                rowVersion: album?.rowVersion,
            };

            if (isEdit && albumId) {
                await updateGalleryAlbum(Number.parseInt(albumId, 10), payload, token);
            } else {
                const created = await createGalleryAlbum(payload, token);
                if (onCreated) { onCreated(created); return; }
            }

            navigate('/portal/gallery');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Spremanje albuma nije uspjelo.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">{isEdit ? ui("Uredi album") : ui("Novi album")}</h2>
                <button
                    type="button"
                    onClick={() => navigate(returnTo ?? '..')}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                    {ui("Nazad")} </button>
            </div>

            {error && <p className="text-sm text-red-600">{ui(error)}</p>}
            <PublicationHelp />
            <InlineImagePicker file={imageFile} onChange={setImageFile} disabled={submitting || (isEdit && !album?.canEdit)} />
            {album && <EditorialPanel type="Gallery" id={album.id} status={album.editorialStatus} rowVersion={album.rowVersion} canSubmit={album.canSubmit} onChanged={() => navigate('/portal/gallery')} />}
            <p className="text-sm text-slate-500">{ui("Spremanje albuma ili izmjena njegovih slika sprema nacrt. Objavu pokrenite iz pregleda albuma.")}</p>
            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm">{ui("Datum događaja")}<input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="rounded border p-2" /></label>
                <label className="flex flex-col text-sm">{ui("Autor / fotograf")}<input maxLength={200} value={photographer} onChange={e => setPhotographer(e.target.value)} className="rounded border p-2" /></label>
            </div>

            <label className="flex flex-col text-sm">
                <span className="font-semibold text-slate-600">{ui("Naslov *")}</span>
                <input
                    type="text"
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    required
                    className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Glavno područje")}</span>
                    <select value={areaId} onChange={event => setAreaId(event.target.value)} className="mt-1 rounded border border-slate-300 p-2">
                        <option value="">{ui("-- Bez područja --")}</option>
                        {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                </label>
                <label className="flex flex-col text-sm">
                    <span className="font-semibold text-slate-600">{ui("Jučer – Danas – Sutra")}</span>
                    <select value={timePerspective} onChange={event => setTimePerspective(event.target.value as '' | ContentTimePerspective)} className="mt-1 rounded border border-slate-300 p-2">
                        <option value="">{ui("-- Bez perspektive --")}</option>
                        <option value="Jucer">{ui("Jučer")}</option>
                        <option value="Danas">{ui("Danas")}</option>
                        <option value="Sutra">{ui("Sutra")}</option>
                    </select>
                </label>
                <div className="md:col-span-2">
                    <TagPicker tags={tags} selectedIds={tagIds} onChange={setTagIds}
                    onCreated={tag => setTags(current => [...current, tag])} onBusyChange={setTagBusy}
                    disabled={translationBusy || submitting || (isEdit && !album?.canEdit)} />
                </div>
            </div>

            <label className="flex flex-col text-sm">
                <span className="font-semibold text-slate-600">{ui("Opis")}</span>
                <textarea
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    rows={4}
                    className="mt-1 rounded border border-slate-300 p-2 focus:border-blue-500 focus:outline-none"
                />
            </label>

            {canManage && <div className="flex flex-col gap-1 text-sm">
                <PagedReferenceSelect label={ui("Povezana obavijest")} value={relatedNewsId} onChange={setRelatedNewsId} loadPage={loadRelatedNews} disabled={translationBusy || tagBusy || submitting || (isEdit && !album?.canEdit)} />
                <p className="text-xs text-slate-500">{ui("Pretraga prikazuje obavijesti bez albuma. Postojeća veza ostaje odabrana dok je izričito ne promijenite.")}</p>
            </div>}

            <TranslationEditor key={albumId ?? 'new'} source={{ title, description }} saved={savedTranslations} edits={translationEdits} onChange={setTranslationEdits} onBusyChange={setTranslationBusy} disabled={translationBusy || tagBusy || submitting || (isEdit && !album?.canEdit)} />

            <button
                type="submit"
                disabled={translationBusy || tagBusy || submitting || (isEdit && !album?.canEdit)}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
                {submitting ? ui("Spremanje...") : isEdit ? ui("Spremi promjene") : ui("Spremi album")}
            </button>
        </form>
    );
}
