import { LanguageProvider } from '@/contexts/LanguageContext';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PagedReferenceSelect from './PagedReferenceSelect';
import type { ListPage } from '@/lib/api-client';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test') }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

describe('Paged reference selection', () => {
    beforeEach(() => vi.clearAllMocks());
    it('preserves an older relation outside the current page and never submits the parent form during lookup', async () => {
        const load = vi.fn().mockResolvedValueOnce({ items: [{ id: 1, title: 'First' }], hasMore: true })
            .mockResolvedValue({ items: [{ id: 2, title: 'Older' }], hasMore: false });
        const changed = vi.fn();
        const submitted = vi.fn(event => event.preventDefault());
        render(<LanguageProvider><form onSubmit={submitted}><PagedReferenceSelect label="Album" value="999" loadPage={load} onChange={changed} /></form></LanguageProvider>);
        await screen.findByRole('option', { name: 'First (#1)' });
        expect(screen.getByRole('combobox', { name: 'Album' })).toHaveValue('999');
        fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
        await screen.findByRole('option', { name: 'Older (#2)' });
        expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Older' } });
        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
        await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'Older' })));
        expect(submitted).not.toHaveBeenCalled();
        expect(changed).not.toHaveBeenCalled();
        await screen.findByRole('option', { name: 'Older (#2)' });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
        expect(changed).toHaveBeenCalledWith('2', { id: 2, title: 'Older' });
    });
    it('keeps the stored ID on errors and retries without silently clearing it', async () => {
        const load = vi.fn().mockRejectedValueOnce(new Error('Failure')).mockResolvedValue({ items: [], hasMore: false });
        const change = vi.fn();
        render(<LanguageProvider><PagedReferenceSelect label="Image" value="999" loadPage={load} onChange={change} /></LanguageProvider>);
        expect(await screen.findByRole('alert')).toHaveTextContent('Failure');
        expect(screen.getByRole('combobox')).toBeDisabled();
        expect(screen.getByRole('combobox')).toHaveValue('999');
        fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovno' }));
        await screen.findByText('Nema rezultata za zadanu pretragu.');
        expect(screen.getByRole('combobox')).toHaveValue('999');
        expect(change).not.toHaveBeenCalled();
    });
    it('rejects stale search results', async () => {
        let resolveOld!: (page: ListPage<{ id: number; title: string }>) => void;
        const load = vi.fn().mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
            .mockResolvedValue({ items: [{ id: 2, title: 'New' }], hasMore: false });
        render(<LanguageProvider><PagedReferenceSelect label="News" value="" loadPage={load} onChange={vi.fn()} /></LanguageProvider>);
        await waitFor(() => expect(load).toHaveBeenCalledOnce());
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New' } });
        fireEvent.click(screen.getByRole('button', { name: 'Pretraži' }));
        await screen.findByRole('option', { name: 'New (#2)' });
        await act(async () => { resolveOld({ items: [{ id: 1, title: 'Stale' }], hasMore: true }); });
        expect(screen.queryByRole('option', { name: 'Stale (#1)' })).not.toBeInTheDocument();
    });
});
