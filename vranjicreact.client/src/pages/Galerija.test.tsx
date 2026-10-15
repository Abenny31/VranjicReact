import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Galerija from './Galerija';
import { fetchGalleryAlbumsPage } from '@/lib/gallery-api';

const language = vi.hoisted(() => ({ t: (_key: string, fallback: string) => fallback }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => language }));
vi.mock('@/lib/gallery-api', () => ({ fetchGalleryAlbumsPage: vi.fn() }));
vi.mock('@/lib/classification-api', () => ({ fetchAreas: vi.fn().mockResolvedValue([]), fetchTags: vi.fn().mockResolvedValue([]) }));
const load = vi.mocked(fetchGalleryAlbumsPage);

describe('Gallery pagination', () => {
    beforeEach(() => { load.mockReset(); });
    it('uses server pages and resets paging when the event year changes', async () => {
        load.mockResolvedValue({ items: [], hasMore: true });
        render(<MemoryRouter><Galerija /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Sljedeća' }));
        await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
        fireEvent.change(screen.getByLabelText('Godina događaja'), { target: { value: '1988' } });
        await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, year: 1988 })));
    });
    it('does not display an empty-gallery message or pagination on request failure', async () => {
        load.mockRejectedValue(new Error('Galerija nije dostupna'));
        render(<MemoryRouter><Galerija /></MemoryRouter>);
        expect(await screen.findByText('Galerija nije dostupna')).toBeInTheDocument();
        expect(screen.queryByText('Galerija je trenutno prazna.')).not.toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: 'Stranice rezultata' })).not.toBeInTheDocument();
    });
});

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ status: 'unauthenticated', hasRole: () => false }) }));
