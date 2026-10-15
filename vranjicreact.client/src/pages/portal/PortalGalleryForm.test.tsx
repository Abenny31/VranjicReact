import { LanguageProvider } from '@/contexts/LanguageContext';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalGalleryForm from './PortalGalleryForm';
import { fetchGalleryAlbum, fetchGalleryAlbumsPage } from '@/lib/gallery-api';
import type { GalleryAlbumSummary } from '@/lib/types';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test') }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/gallery-api', () => ({
    fetchGalleryAlbum: vi.fn(), fetchGalleryAlbumsPage: vi.fn(), fetchGalleryItem: vi.fn(), createGalleryItem: vi.fn(), updateGalleryItem: vi.fn(),
}));
const album = (id: number): GalleryAlbumSummary => ({ id, title: `Album ${id}`, imageCount: 0, tags: [], rowVersion: 'AQ==', canEdit: true, canSubmit: true, canViewHistory: true });

describe('Gallery upload album selection', () => {
    beforeEach(() => { vi.clearAllMocks(); });
    it('keeps an explicitly linked older album selected while loading more options', async () => {
        vi.mocked(fetchGalleryAlbumsPage).mockResolvedValueOnce({ items: [album(1)], hasMore: true })
            .mockResolvedValueOnce({ items: [album(2)], hasMore: false });
        vi.mocked(fetchGalleryAlbum).mockResolvedValue({ album: album(500), images: [] });
        render(<LanguageProvider><MemoryRouter initialEntries={['/portal/gallery/new?albumId=500']}><PortalGalleryForm /></MemoryRouter></LanguageProvider>);
        expect(await screen.findByRole('option', { name: 'Album 500' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Album/ })).toHaveValue('500');
        fireEvent.click(screen.getByRole('button', { name: 'Učitaj još albuma' }));
        await waitFor(() => expect(fetchGalleryAlbumsPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, editableOnly: true })));
        expect(await screen.findByRole('option', { name: 'Album 2' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /Album/ })).toHaveValue('500');
        expect(screen.getByRole('option', { name: 'Album 1' })).toBeInTheDocument();
    });
    it('blocks upload rather than silently switching away from an inaccessible album', async () => {
        vi.mocked(fetchGalleryAlbumsPage).mockResolvedValue({ items: [album(1)], hasMore: false });
        vi.mocked(fetchGalleryAlbum).mockResolvedValue({ album: { ...album(500), canEdit: false }, images: [] });
        render(<LanguageProvider><MemoryRouter initialEntries={['/portal/gallery/new?albumId=500']}><PortalGalleryForm /></MemoryRouter></LanguageProvider>);
        expect(await screen.findByRole('alert')).toHaveTextContent('Nemate pravo dodavati');
        expect(screen.getByRole('button', { name: 'Spremi' })).toBeDisabled();
        expect(screen.queryByRole('option', { name: 'Album 1' })).not.toBeInTheDocument();
    });
    it('rejects unsupported mobile images before upload and exposes a separate camera picker', async () => {
        vi.mocked(fetchGalleryAlbumsPage).mockResolvedValue({ items: [album(1)], hasMore: false });
        render(<LanguageProvider><MemoryRouter><PortalGalleryForm /></MemoryRouter></LanguageProvider>);
        await screen.findByRole('option', { name: 'Album 1' });
        const input = screen.getByLabelText('Datoteka *');
        fireEvent.change(input, { target: { files: [new File(['test'], 'camera.heic', { type: 'image/heic' })] } });
        expect(await screen.findByText(/HEIC\/HEIF fotografije zasad nisu podržane/)).toBeInTheDocument();
        expect(input).not.toHaveAttribute('capture');
        fireEvent.click(screen.getByText('Fotografiraj kamerom'));
        expect(screen.getByLabelText('Kamera (ako je uređaj podržava)')).toHaveAttribute('capture', 'environment');
    });
});
