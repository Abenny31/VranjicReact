import { fetchTags } from '@/lib/classification-api';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalUpdates from './PortalUpdates';
import { fetchEditorialUpdates, type EditorialUpdate, type EditorialUpdatesPage } from '@/lib/updates-api';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test'), hasRole: vi.fn().mockReturnValue(false) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/classification-api', () => ({ fetchTags: vi.fn() }));
vi.mock('@/lib/updates-api', () => ({ fetchEditorialUpdates: vi.fn() }));
const fetchMock = vi.mocked(fetchEditorialUpdates);
const item: EditorialUpdate = {
    id: 1, contentType: 'News', title: 'Moja objava', slug: 'moja-objava', editorialStatus: 'Draft', rowVersion: 'AQ==',
    lastChangedAt: '2026-09-25T10:00:00Z', isActive: false, isExpired: false, canEdit: true, canSubmit: true, canViewHistory: true,
};
const show = (path = '/portal/updates') => render(<LanguageProvider><MemoryRouter initialEntries={[path]}><PortalUpdates /></MemoryRouter></LanguageProvider>);

describe('PortalUpdates', () => {
    beforeEach(() => {
        fetchMock.mockReset(); vi.mocked(fetchTags).mockResolvedValue([{ id: 2, name: 'Događaji', slug: 'dogadaji', isActive: true }]);
        auth.getAccessToken.mockResolvedValue('Bearer test');
    });
    it('loads URL filters, paginates and resets the page when filters change', async () => {
        fetchMock.mockResolvedValue({ items: [item], page: 3, hasMore: true });
        show('/portal/updates?kind=News&status=Draft&search=Moja&page=3&tagId=2');
        expect(screen.getByText('Učitavanje...')).toHaveTextContent('Učitavanje');
        expect(await screen.findByRole('link', { name: 'Uredi' })).toHaveAttribute('href', '/portal/news/1/edit');
        expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'News', status: 'Draft', search: 'Moja', page: 3, tagId: 2 }));
        fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 4 })));
        fireEvent.change(screen.getByLabelText('Vrsta'), { target: { value: 'Announcement' } });
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'Announcement', status: 'Draft', page: 1 })));
        fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Published' } });
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'Announcement', status: 'Published', page: 1 })));
        fireEvent.change(screen.getByLabelText('Pretraga naslova'), { target: { value: '  Riva  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Pretraži' }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'Announcement', status: 'Published', search: 'Riva', page: 1, tagId: 2 })));
    });
    it('shows an error with retry, then a genuine empty state', async () => {
        fetchMock.mockRejectedValueOnce(new Error('API nije dostupan')).mockResolvedValue({ items: [], page: 1, hasMore: false });
        show();
        expect(await screen.findByRole('alert')).toHaveTextContent('API nije dostupan');
        expect(screen.queryByText('Nema objava za ovaj odabir.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovno' }));
        expect(await screen.findByText('Nema objava za ovaj odabir.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sljedeća' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Prethodna' })).toBeDisabled();
    });
    it('hides unavailable editorial actions and history on foreign public content', async () => {
        fetchMock.mockResolvedValue({ items: [{ ...item, contentType: 'Announcement', editorialStatus: 'Published', isExpired: true,
            canEdit: false, canSubmit: false, canViewHistory: false }], page: 1, hasMore: false });
        show();
        expect(await screen.findByRole('link', { name: 'Pregledaj' })).toHaveAttribute('href', '/portal/announcements/1/edit');
        expect(screen.getByText('Istekla — dostupna u arhivi novosti.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Povijest moderiranja' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pošalji na pregled' })).not.toBeInTheDocument();
    });
    it('aborts old requests and ignores late results after a filter change', async () => {
        let resolveOld!: (page: EditorialUpdatesPage) => void;
        fetchMock.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
            .mockResolvedValue({ items: [], page: 1, hasMore: false });
        show();
        await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
        const oldSignal = fetchMock.mock.calls[0][0].signal;
        fireEvent.click(screen.getByText('Dodatni filtri'));
        fireEvent.change(screen.getByLabelText('Vrsta'), { target: { value: 'Announcement' } });
        expect(await screen.findByText('Nema objava za ovaj odabir.')).toBeInTheDocument();
        expect(oldSignal?.aborted).toBe(true);
        await act(async () => { resolveOld({ items: [item], page: 1, hasMore: true }); });
        expect(screen.queryByText(/Moja objava/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sljedeća' })).toBeDisabled();
    });
});
