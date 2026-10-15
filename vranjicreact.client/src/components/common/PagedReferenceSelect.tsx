import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useCallback, useState } from 'react';
import { useEditorialList } from '@/hooks/useEditorialList';
import type { ListPage } from '@/lib/api-client';
import ListPagination from './ListPagination';

export interface ReferenceSearch {
    page: number;
    search: string;
    authorization: string;
    signal: AbortSignal;
}

interface Props<T extends { id: number; title: string }> {
    label: string;
    value: string;
    onChange: (value: string, item?: T) => void;
    loadPage: (options: ReferenceSearch) => Promise<ListPage<T>>;
    disabled?: boolean;
}

/** Does not change a stored relation merely because it is absent from the current result page. */
export default function PagedReferenceSelect<T extends { id: number; title: string }>({ label, value, onChange, loadPage, disabled = false }: Props<T>) {
    const { ui } = useUiTranslation();
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const load = useCallback((options: Omit<ReferenceSearch, 'search'>) => loadPage({ ...options, search }), [loadPage, search]);
    const list = useEditorialList(load);
    const applySearch = () => { setSearch(input.trim()); list.setPage(1); };
    const visibleItems = list.loading || list.error ? [] : list.items;
    return <fieldset disabled={disabled} className="space-y-2 rounded border border-slate-200 p-3 text-sm">
        <legend className="px-1 font-semibold">{label}</legend>
        <div className="flex flex-wrap gap-2">
            <input aria-label={ui('Pretraga: {label}', { label })} value={input} maxLength={200} onChange={event => setInput(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applySearch(); } }} className="min-w-0 rounded border p-2" />
            <button type="button" onClick={applySearch} className="rounded border px-3 py-2">{ui("Pretraži")}</button>
        </div>
        {list.loading && <p role="status">{ui("Učitavanje...")}</p>}
        {list.error && <div role="alert" className="text-red-600">{ui(list.error)} <button type="button" onClick={list.refresh}>{ui("Pokušaj ponovno")}</button></div>}
        <select aria-label={label} value={value} disabled={list.loading || !!list.error} className="w-full rounded border p-2"
            onChange={event => onChange(event.target.value, list.items.find(item => String(item.id) === event.target.value))}>
            <option value="">{ui("-- Bez povezivanja --")}</option>
            {value && !visibleItems.some(item => String(item.id) === value) && <option value={value}>{ui("Postojeći odabir (#")}{value})</option>}
            {visibleItems.map(item => <option key={item.id} value={item.id}>{item.title || ui("Bez naziva")} (#{item.id})</option>)}
        </select>
        {!list.loading && !list.error && !list.items.length && <p>{ui("Nema rezultata za zadanu pretragu.")}</p>}
        <ListPagination page={list.page} hasMore={list.hasMore} onPageChange={list.setPage} disabled={disabled || list.loading || !!list.error} />
    </fieldset>;
}
