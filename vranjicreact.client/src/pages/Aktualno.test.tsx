import { fetchTags } from '@/lib/classification-api';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Aktualno from './Aktualno';
import { fetchUpdates } from '@/lib/updates-api';
vi.mock('@/lib/classification-api', () => ({ fetchTags: vi.fn() }));
vi.mock('@/lib/updates-api', () => ({ fetchUpdates: vi.fn() }));
const fetchMock = vi.mocked(fetchUpdates);
describe('Aktualno', () => {
    beforeEach(() => { fetchMock.mockReset(); vi.mocked(fetchTags).mockResolvedValue([{ id: 2, name: 'Događaji', slug: 'dogadaji', isActive: true }]); });
    const show = () => render(<LanguageProvider><MemoryRouter><Aktualno /></MemoryRouter></LanguageProvider>);
    it('shows loading then empty state', async () => {
        fetchMock.mockResolvedValue({ items: [], page: 1, hasMore: false });
        show();
        expect(screen.getByText('Učitavanje objava...')).toHaveTextContent('Učitavanje');
        expect(await screen.findByText('Nema objavljenih sadržaja.')).toBeInTheDocument();
    });
    it('shows errors without reporting an empty result', async () => {
        fetchMock.mockRejectedValue(new Error('API nije dostupan'));
        show();
        expect(await screen.findByRole('alert')).toHaveTextContent('API nije dostupan');
        expect(screen.queryByText('Nema objavljenih sadržaja.')).not.toBeInTheDocument();
    });
    it('preserves the selected tag across paging and resets page when a tag changes', async () => {
        fetchMock.mockResolvedValue({ items: [], page: 3, hasMore: true });
        render(<LanguageProvider><MemoryRouter initialEntries={['/aktualno?kind=News&tagId=2&page=3']}><Aktualno /></MemoryRouter></LanguageProvider>);
        await screen.findByRole('option', { name: 'Događaji' });
        expect(screen.getByRole('combobox', { name: 'Oznaka' })).toHaveValue('2');
        expect(fetchMock).toHaveBeenLastCalledWith('News', 3, expect.any(AbortSignal), 2);
        fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('News', 4, expect.any(AbortSignal), 2));
        fireEvent.change(screen.getByRole('combobox', { name: 'Oznaka' }), { target: { value: '' } });
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('News', 1, expect.any(AbortSignal), undefined));
        expect(screen.getByRole('heading', { name: 'Novosti' })).toBeInTheDocument();
    });

    it('uses distinct detail routes, server pagination and resets page on filtering', async () => {
        fetchMock.mockResolvedValue({ page: 1, hasMore: true, items: [
            { id: 1, contentType: 'News', slug: 'vijest', title: 'Vijest', summary: 'Sažetak', publishedAt: '2026-01-01T00:00:00Z', priority: 0 },
            { id: 1, contentType: 'Announcement', slug: 'obavijest', title: 'Obavijest', summary: 'Sažetak', publishedAt: '2026-01-01T00:00:00Z', priority: 2 },
        ] });
        show();
        expect(await screen.findByRole('link', { name: 'Vijest' })).toHaveAttribute('href', '/novosti/vijest');
        expect(screen.getByRole('link', { name: 'Obavijest' })).toHaveAttribute('href', '/obavijesti/obavijest');
        fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('', 2, expect.any(AbortSignal), undefined));
        fireEvent.click(screen.getByText('Dodatni filtri'));
        fireEvent.click(screen.getByRole('button', { name: 'Objave s rasporedom' }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('Announcement', 1, expect.any(AbortSignal), undefined));
    });
});

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ status: 'unauthenticated', hasRole: () => false }) }));
