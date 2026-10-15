import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { createTag } from '@/lib/classification-api';
import { CONTENT_MANAGE_ROLES, hasAnyRole } from '@/lib/auth-roles';
import { suggestedTagNames } from '@/lib/tag-suggestions';
import type { Tag } from '@/lib/types';

interface Props {
    tags: Tag[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    onCreated: (tag: Tag) => void;
    onBusyChange: (busy: boolean) => void;
    disabled?: boolean;
}

export default function TagPicker({ tags, selectedIds, onChange, onCreated, onBusyChange, disabled = false }: Props) {
    const { ui } = useUiTranslation();
    const { hasRole, getAccessToken } = useAuth();
    const canManage = hasAnyRole(hasRole, CONTENT_MANAGE_ROLES);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        if (saving || disabled || !canManage || !name.trim()) return;
        setError(null);
        const existing = tags.find(tag => tag.name.toLocaleLowerCase('hr') === name.trim().toLocaleLowerCase('hr'));
        if (existing) {
            if (!selectedIds.includes(String(existing.id))) onChange([...selectedIds, String(existing.id)]);
            setName('');
            return;
        }
        setSaving(true);
        onBusyChange(true);
        try {
            const token = await getAccessToken();
            if (!token) throw new Error('Sesija je istekla. Prijavite se ponovno.');
            const created = await createTag({ name: name.trim(), isActive: true }, token);
            onCreated(created);
            onChange([...selectedIds, String(created.id)]);
            setName('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Oznaka nije spremljena.');
        } finally { setSaving(false); onBusyChange(false); }
    };

    return <fieldset disabled={disabled || saving} className="space-y-3 rounded border border-slate-200 p-3 text-sm">
        <legend className="px-1 font-semibold text-slate-600">{ui('Oznake')}</legend>
        <div className="flex flex-wrap gap-3">{tags.map(tag => <label key={tag.id} className="flex items-center gap-2">
            <input type="checkbox" checked={selectedIds.includes(String(tag.id))} onChange={event => onChange(event.target.checked
                ? [...selectedIds, String(tag.id)] : selectedIds.filter(id => id !== String(tag.id)))} />
            {tag.name}
        </label>)}</div>
        {tags.length === 0 && <p className="text-slate-500">{ui('Još nema oznaka.')}</p>}
        {canManage ? <details>
            <summary className="cursor-pointer text-blue-700">{ui('Dodaj oznaku')}</summary>
            <p className="mt-2 text-xs text-slate-500">{ui('Nova oznaka bit će dostupna svim objavama. Možete odabrati prijedlog ili upisati svoj naziv.')}</p>
            <div className="my-2 flex flex-wrap gap-2">{suggestedTagNames.filter(value => !tags.some(tag => tag.name.toLocaleLowerCase('hr') === value.toLocaleLowerCase('hr'))).map(value =>
                <button type="button" key={value} onClick={() => setName(value)} className="rounded border px-2 py-1">{ui(value)}</button>)}</div>
            <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">{ui('Naziv nove oznake')}
                    <input value={name} maxLength={100} onChange={event => setName(event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }} className="rounded border p-2" />
                </label>
                <button type="button" disabled={!name.trim() || saving} onClick={() => void add()} className="rounded border px-3 py-2 disabled:opacity-50">{ui(saving ? 'Spremanje...' : 'Dodaj i odaberi')}</button>
            </div>
            {error && <p role="alert" className="mt-2 text-red-600">{ui(error)}</p>}
        </details> : <p className="text-xs text-slate-500">{ui('Možete odabrati više oznaka. Nove oznake dodaje administrator.')}</p>}
    </fieldset>;
}
