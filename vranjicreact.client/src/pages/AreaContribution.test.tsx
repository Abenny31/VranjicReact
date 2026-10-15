import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AreaContribution from './AreaContribution';
import AreaContributionLink from '@/components/common/AreaContributionLink';
import { fetchArea, fetchAreas, fetchTags } from '@/lib/classification-api';
import { createBlogPost, fetchBlogPostDetail } from '@/lib/blog-api';
import { fetchNewsPage } from '@/lib/news-api';
import { fetchGalleryAlbumsPage, fetchGalleryItemsPage } from '@/lib/gallery-api';
import { submitForReview } from '@/lib/moderation-api';
import type { Area, BlogPostDetail } from '@/lib/types';
import ContributionActions from '@/components/common/ContributionActions';

const auth = vi.hoisted(() => ({
    status: 'authenticated',
    getAccessToken: vi.fn().mockResolvedValue('Bearer test'),
    hasRole: vi.fn((role: string) => role === 'Korisnik'),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/LanguageContext', () => {
    const t = (_key: string, fallback: string) => fallback;
    return { useLanguage: () => ({ t }) };
});
vi.mock('@/lib/classification-api');
vi.mock('@/lib/blog-api');
vi.mock('@/lib/news-api');
vi.mock('@/lib/gallery-api');
vi.mock('@/lib/announcements-api');
vi.mock('@/lib/moderation-api');
vi.mock('@/contexts/PublicDisplayContext', () => ({ usePublicDisplay: () => ({
    loading: false, areaTagSlugs: { 'torcida-vranjic': ['torcida'] }, contentTagSlugs: { obavijest: ['novosti'] },
}) }));

const area: Area = { id: 42, name: 'Torcida Vranjic', slug: 'torcida-vranjic', sortOrder: 1, isActive: true, createdAt: '2026-01-01' };
const draft: BlogPostDetail = {
    id: 73, title: 'Naša priča', slug: 'nasa-prica', excerpt: 'Sažetak', body: 'Sjećanje',
    isFeatured: false, publishedAt: null, createdAt: '2026-01-01', tags: [], sources: [],
    rowVersion: 'AQ==', canEdit: true, canSubmit: true, editorialStatus: 'Draft', area,
};
function show(path: string) {
    return render(<MemoryRouter initialEntries={[path]}><Routes>
        <Route path="/nase-malo-misto/:slug/dodaj/:kind?/:contentId?" element={<AreaContribution />} />
        <Route path="/dodaj/:kind/:contentId?" element={<AreaContribution />} />
    </Routes></MemoryRouter>);
}

afterEach(() => vi.unstubAllGlobals());

describe('Adding content from an area', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.status = 'authenticated';
        auth.hasRole.mockImplementation(role => role === 'Korisnik');
        vi.mocked(fetchArea).mockResolvedValue(area);
        vi.mocked(fetchAreas).mockResolvedValue([area]);
        vi.mocked(fetchTags).mockResolvedValue([]);
        vi.mocked(fetchGalleryAlbumsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchGalleryItemsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchNewsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(createBlogPost).mockResolvedValue(draft);
        vi.mocked(fetchBlogPostDetail).mockResolvedValue(draft);
    });

    it.each(['prica', 'obavijest', 'vremenska-obavijest', 'galerija'])('preselects the area in the real %s form', async kind => {
        show(`/nase-malo-misto/torcida-vranjic/dodaj/${kind}`);
        await waitFor(() => expect(screen.getByRole('combobox', { name: /područje/i })).toHaveValue('42'));
    });

    it('carries configured and selected tags plus perspective into the global creation form', async () => {
        vi.mocked(fetchTags).mockResolvedValue([
            { id: 3, name: 'Torcida', slug: 'torcida', isActive: true },
            { id: 4, name: 'Sjećanja', slug: 'sjecanja', isActive: true },
            { id: 5, name: 'Neaktivna', slug: 'torcida', isActive: false },
        ]);
        show('/dodaj/prica?area=torcida-vranjic&tagId=4&perspective=Jucer');
        expect(await screen.findByRole('checkbox', { name: 'Torcida' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Sjećanja' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Neaktivna' })).not.toBeChecked();
        expect(screen.getByRole('combobox', { name: 'Perspektiva' })).toHaveValue('Jucer');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Torcida' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Naslov *' }), { target: { value: 'Moja priča' } });
        expect(screen.getByRole('checkbox', { name: 'Torcida' })).not.toBeChecked();
    });

    it('uses post defaults without requiring an area', async () => {
        vi.mocked(fetchTags).mockResolvedValue([{ id: 8, name: 'Novosti', slug: 'novosti', isActive: true }]);
        show('/dodaj/obavijest');
        expect(await screen.findByRole('checkbox', { name: 'Novosti' })).toBeChecked();
        expect(screen.getByRole('combobox', { name: /područje/i })).toHaveValue('');
        expect(fetchArea).not.toHaveBeenCalled();
    });

    it('shows contextual shortcuts only to authenticated creators', () => {
        const view = render(<MemoryRouter><ContributionActions area="torcida-vranjic" /></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Dodaj priču' })).toHaveAttribute('href', '/dodaj/prica?area=torcida-vranjic');
        expect(screen.getAllByRole('link')).toHaveLength(3);
        auth.hasRole.mockReturnValue(false);
        view.rerender(<MemoryRouter><ContributionActions /></MemoryRouter>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        auth.hasRole.mockReturnValue(true); auth.status = 'unauthenticated';
        view.rerender(<MemoryRouter><ContributionActions /></MemoryRouter>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('keeps the selected photo on save failure and sends it with the story, not on selection', async () => {
        vi.stubGlobal('URL', class extends URL { static createObjectURL = () => 'blob:test'; static revokeObjectURL = () => {}; });
        vi.mocked(createBlogPost).mockRejectedValueOnce(new Error('Spremanje privremeno nije dostupno.'));
        show('/dodaj/prica');
        const input = await screen.findByLabelText('Odaberi fotografiju s uređaja');
        fireEvent.change(input, { target: { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] } });
        expect(createBlogPost).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Snimi fotografiju')).toHaveAttribute('capture', 'environment');
        fireEvent.change(screen.getByRole('textbox', { name: 'Naslov *' }), { target: { value: draft.title } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Sažetak *' }), { target: { value: draft.excerpt } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Sadržaj *' }), { target: { value: draft.body } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi priču' }));
        expect(await screen.findByText('Spremanje privremeno nije dostupno.')).toBeInTheDocument();
        expect(createBlogPost).toHaveBeenCalledWith(expect.objectContaining({ imageUpload: { contentType: 'image/jpeg', base64Data: 'cGhvdG8=' } }), 'Bearer test');
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Naslov *' })).toHaveValue(draft.title);
    });

    it('creates a draft and submits the saved version for review without opening the portal', async () => {
        show('/nase-malo-misto/torcida-vranjic/dodaj/prica');
        await screen.findByRole('textbox', { name: 'Naslov *' });
        fireEvent.change(screen.getByRole('textbox', { name: 'Naslov *' }), { target: { value: draft.title } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Sažetak *' }), { target: { value: draft.excerpt } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Sadržaj *' }), { target: { value: draft.body } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi priču' }));
        const submit = await screen.findByRole('button', { name: 'Pošalji na pregled' });
        expect(createBlogPost).toHaveBeenCalledWith(expect.objectContaining({ areaId: 42, title: draft.title, publishedAt: null }), 'Bearer test');
        expect(fetchBlogPostDetail).toHaveBeenCalledWith('73', { authorization: 'Bearer test', includeUnpublished: true });
        expect(screen.queryByRole('button', { name: 'Objavi izravno' })).not.toBeInTheDocument();
        vi.mocked(fetchBlogPostDetail).mockResolvedValue({ ...draft, editorialStatus: 'PendingReview', rowVersion: 'Ag==', canEdit: false, canSubmit: false });
        fireEvent.click(submit);
        await waitFor(() => expect(submitForReview).toHaveBeenCalledWith('Blog', 73, 'AQ==', 'Bearer test'));
        expect(await screen.findByText(/Zahtjev je poslan/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pošalji na pregled' })).not.toBeInTheDocument();
        expect(createBlogPost).toHaveBeenCalledTimes(1);
    });

    it('reloads a saved draft without creating a duplicate and keeps it editable when submission fails', async () => {
        vi.mocked(submitForReview).mockRejectedValueOnce(new Error('Sadržaj je u međuvremenu promijenjen.'));
        show('/nase-malo-misto/torcida-vranjic/dodaj/prica/73');
        fireEvent.click(await screen.findByRole('button', { name: 'Pošalji na pregled' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Sadržaj je u međuvremenu promijenjen.');
        expect(createBlogPost).not.toHaveBeenCalled();
        expect(screen.getByRole('link', { name: 'Uredi spremljeni sadržaj' })).toHaveAttribute('href', '/portal/blog/73/edit');
    });

    it('shows a missing area error without presenting a form', async () => {
        vi.mocked(fetchArea).mockRejectedValueOnce(new Error('Područje nije pronađeno.'));
        show('/nase-malo-misto/nepostojece/dodaj/prica');
        expect(await screen.findByRole('alert')).toHaveTextContent('Područje nije pronađeno.');
        expect(screen.queryByRole('button', { name: 'Spremi priču' })).not.toBeInTheDocument();
    });

    it('offers login to visitors and hides creation from authenticated readers', () => {
        auth.status = 'unauthenticated';
        const view = render(<MemoryRouter><AreaContributionLink slug={area.slug} /></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Prijavi se i dodaj sadržaj' })).toHaveAttribute('href', '/nase-malo-misto/torcida-vranjic/dodaj');
        auth.status = 'authenticated';
        auth.hasRole.mockReturnValue(false);
        view.rerender(<MemoryRouter><AreaContributionLink slug={area.slug} /></MemoryRouter>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
