import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalNewsForm from './PortalNewsForm';
import PortalGalleryAlbumForm from './PortalGalleryAlbumForm';
import { fetchNewsDetail, fetchNewsPage, updateNews } from '@/lib/news-api';
import { fetchGalleryAlbum, fetchGalleryAlbumsPage, fetchGalleryItemsPage, updateGalleryAlbum } from '@/lib/gallery-api';
import { fetchAreas, fetchTags } from '@/lib/classification-api';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test'), hasRole: () => true }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/LanguageContext', () => {
    const t = (_key: string, fallback: string) => fallback;
    return { useLanguage: () => ({ t }) };
});
vi.mock('@/components/common/EditorialPanel', () => ({ default: () => null, ModerationHistory: () => null }));
vi.mock('@/lib/classification-api', () => ({ fetchAreas: vi.fn(), fetchTags: vi.fn() }));
vi.mock('@/lib/news-api', () => ({ fetchNewsDetail: vi.fn(), fetchNewsPage: vi.fn(), updateNews: vi.fn(), createNews: vi.fn() }));
vi.mock('@/lib/gallery-api', () => ({ fetchGalleryAlbum: vi.fn(), fetchGalleryAlbumsPage: vi.fn(), fetchGalleryItemsPage: vi.fn(), updateGalleryAlbum: vi.fn(), createGalleryAlbum: vi.fn() }));

describe('Stored relations in editorial forms', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAreas).mockResolvedValue([]);
        vi.mocked(fetchTags).mockResolvedValue([]);
        vi.mocked(fetchGalleryAlbumsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchGalleryItemsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchNewsPage).mockResolvedValue({ items: [], hasMore: false });
    });
    it('retains older album/image IDs when saving a news item despite empty lookup pages', async () => {
        vi.mocked(fetchNewsDetail).mockResolvedValue({ id: 1, title: 'Existing', slug: 'existing', excerpt: 'Excerpt', body: 'Body',
            createdAt: '2026-01-01T00:00:00Z', publishedAt: null, isFeatured: false, galleryAlbumId: 900, galleryImageId: 901,
            tags: [], rowVersion: 'AQ==', canEdit: true, canSubmit: true });
        render(<MemoryRouter initialEntries={['/news/1']}><Routes><Route path="/news/:id" element={<PortalNewsForm />} /></Routes></MemoryRouter>);
        await screen.findByRole('combobox', { name: 'Album galerije' });
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Album galerije' })).toBeEnabled());
        expect(screen.getByRole('combobox', { name: 'Album galerije' })).toHaveValue('900');
        expect(screen.getByRole('combobox', { name: 'Slika iz galerije' })).toHaveValue('901');
        fireEvent.submit(screen.getByRole('combobox', { name: 'Album galerije' }).closest('form')!);
        await waitFor(() => expect(updateNews).toHaveBeenCalledWith(1, expect.objectContaining({ galleryAlbumId: 900, galleryImageId: 901 }), 'Bearer test'));
    });
    it('retains an existing linked news ID excluded from the unlinked-only query', async () => {
        vi.mocked(fetchGalleryAlbum).mockResolvedValue({ album: { id: 7, title: 'Album', imageCount: 0, relatedNewsId: 999,
            tags: [], rowVersion: 'AQ==', canEdit: true, canSubmit: true, canViewHistory: true }, images: [] });
        render(<MemoryRouter initialEntries={['/albums/7']}><Routes><Route path="/albums/:albumId" element={<PortalGalleryAlbumForm />} /></Routes></MemoryRouter>);
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Povezana obavijest' })).toHaveValue('999'));
        expect(fetchNewsPage).toHaveBeenCalledWith(expect.objectContaining({ unlinkedOnly: true, includeUnpublished: true }));
        fireEvent.submit(screen.getByRole('combobox', { name: 'Povezana obavijest' }).closest('form')!);
        await waitFor(() => expect(updateGalleryAlbum).toHaveBeenCalledWith(7, expect.objectContaining({ relatedNewsId: 999 }), 'Bearer test'));
    });
});
