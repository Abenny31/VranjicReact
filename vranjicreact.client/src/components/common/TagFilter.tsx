import { useEffect, useState } from 'react';
import { useLocalizedContentState } from '@/hooks/useLocalizedContentState';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { fetchTags } from '@/lib/classification-api';
import type { Tag } from '@/lib/types';

export function parseTagId(value: string | null): number | undefined {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : undefined;
}

export default function TagFilter({ value, onChange }: { value: number | undefined; onChange: (value: string) => void }) {
    const { ui } = useUiTranslation();
    const [tags, setTags] = useLocalizedContentState<Tag[] | null>(null);
    const [error, setError] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setError(false);
        setTags(null);
        fetchTags(controller.signal).then(result => {
            if (!controller.signal.aborted) setTags(result);
        }).catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => controller.abort();
    }, [revision, setTags]);

    return <div className="text-sm">
        <label className="flex flex-col gap-1">{ui('Oznaka')}
            <select value={value ?? ''} onChange={event => onChange(event.target.value)} className="rounded border p-2">
                <option value="">{ui('Sve oznake')}</option>
                {value && !tags?.some(tag => tag.id === value) && <option value={value}>{ui('Odabrana oznaka')} #{value}</option>}
                {tags?.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
        </label>
        {!tags && !error && <p role="status" className="text-xs text-slate-500">{ui('Učitavanje oznaka...')}</p>}
        {error && <p role="alert" className="text-xs text-red-600">{ui('Oznake se ne mogu učitati.')} <button type="button" onClick={() => setRevision(current => current + 1)} className="underline">{ui('Pokušaj ponovno')}</button></p>}
    </div>;
}
