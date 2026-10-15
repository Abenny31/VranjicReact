import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import Header from '@/components/widgets/Header';
import Footer2 from '@/components/widgets/Footer2';
import PortalNewsForm from './portal/PortalNewsForm';
import AreaContribution from './AreaContribution';
import BlogDetalj from './BlogDetalj';
import { fetchArea, fetchAreas, fetchTags } from '@/lib/classification-api';
import { fetchNewsDetail, fetchNewsPage, updateNews } from '@/lib/news-api';
import { fetchGalleryAlbumsPage, fetchGalleryItemsPage } from '@/lib/gallery-api';
import { createBlogPost, fetchBlogPostDetail } from '@/lib/blog-api';
import type { Area, BlogPostDetail, NewsDetail } from '@/lib/types';
import { translateText } from '@/lib/translation-api';
import { PublicContactProvider } from '@/contexts/PublicContactContext';
import { fetchPublicContact } from '@/lib/public-contact-api';

const auth = vi.hoisted(() => ({
    status: 'authenticated', getAccessToken: vi.fn().mockResolvedValue('Bearer test'),
    hasRole: (role: string) => role === 'Korisnik', logout: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/classification-api');
vi.mock('@/lib/news-api');
vi.mock('@/lib/blog-api');
vi.mock('@/lib/gallery-api');
vi.mock('@/lib/announcements-api');
vi.mock('@/lib/moderation-api');
vi.mock('@/lib/translation-api');
vi.mock('@/lib/public-contact-api');

function LanguageSwitch() {
    const { setLanguage } = useLanguage();
    return <><button onClick={() => setLanguage('hr')}>Test HR</button><button onClick={() => setLanguage('en')}>Test EN</button></>;
}
const area: Area = { id: 42, name: 'Vatrogasci', slug: 'vatrogasci', sortOrder: 1, isActive: true, createdAt: '2026-01-01' };
const story: BlogPostDetail = {
    id: 73, title: 'Obavijesti', slug: 'izvorni-naslov', excerpt: 'Izvorni sažetak', body: 'Danas',
    isFeatured: false, publishedAt: '2026-10-05T12:00:00Z', createdAt: '2026-10-01', tags: [], sources: [],
    rowVersion: 'AQ==', canEdit: true, canSubmit: true, editorialStatus: 'Draft', area, timePerspective: 'Jucer',
};

describe('Croatian and English interface', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchPublicContact).mockResolvedValue({ address: '', email: '', supportEmail: '', phone: '', facebookUrl: '' });
        window.localStorage.clear();
        vi.mocked(fetchArea).mockResolvedValue(area);
        vi.mocked(fetchAreas).mockResolvedValue([area]);
        vi.mocked(fetchTags).mockResolvedValue([]);
        vi.mocked(fetchNewsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchGalleryAlbumsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchGalleryItemsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchBlogPostDetail).mockResolvedValue(story);
        vi.mocked(createBlogPost).mockResolvedValue(story);
    });

    it('restores English, translates navigation and credits, and switches back without changing area names', async () => {
        window.localStorage.setItem('vranjicreact.language', 'en');
        render(<LanguageProvider><PublicContactProvider><MemoryRouter><Header /><Footer2 /></MemoryRouter></PublicContactProvider></LanguageProvider>);
        expect(screen.getByRole('link', { name: 'Our little town' })).toHaveAttribute('href', '/nase-malo-misto');
        expect(screen.getByRole('link', { name: 'Stories' })).toHaveAttribute('href', '/blog');
        expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
        expect(screen.getByText('Created by the Don Frane Bulić Association - Vranjic')).toBeInTheDocument();
        expect(screen.getByLabelText('AB31 — website creator').tagName).toBe('SPAN');
        expect(document.documentElement.lang).toBe('en');
        fireEvent.click(screen.getByRole('button', { name: 'Open Our little town menu' }));
        expect(await screen.findByRole('link', { name: 'Vatrogasci' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'HR' }));
        expect(screen.getByRole('link', { name: 'Priče' })).toBeInTheDocument();
        expect(screen.getByText(/Sva prava pridržana/)).toBeInTheDocument();
        expect(screen.getByLabelText('AB31 — autor web-stranice')).toBeInTheDocument();
        expect(document.documentElement.lang).toBe('hr');
        expect(window.localStorage.getItem('vranjicreact.language')).toBe('hr');
    });

    it('preserves an edited notice and its concurrency version when switching languages', async () => {
        const notice: NewsDetail = { ...story, publishedAt: story.publishedAt ?? null };
        vi.mocked(fetchNewsDetail).mockResolvedValue(notice);
        render(<LanguageProvider><MemoryRouter initialEntries={['/news/73/edit']}><LanguageSwitch /><Routes>
            <Route path="/news/:id/edit" element={<PortalNewsForm />} />
        </Routes></MemoryRouter></LanguageProvider>);
        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Naslov *' })).toHaveValue('Obavijesti'));
        fireEvent.change(screen.getByRole('textbox', { name: 'Naslov *' }), { target: { value: 'Nespremljen hrvatski naslov' } });
        fireEvent.click(screen.getByRole('button', { name: 'Test EN' }));
        expect(screen.getByRole('textbox', { name: 'Title *' })).toHaveValue('Nespremljen hrvatski naslov');
        expect(screen.getByRole('combobox', { name: 'Main area' })).toHaveValue('42');
        expect(screen.getByText('How does content become public?')).toBeInTheDocument();
        expect(fetchNewsDetail).toHaveBeenCalledTimes(1);
        fireEvent.submit(screen.getByRole('textbox', { name: 'Title *' }).closest('form')!);
        await waitFor(() => expect(updateNews).toHaveBeenCalledWith(73, expect.objectContaining({
            title: 'Nespremljen hrvatski naslov', rowVersion: 'AQ==', areaId: 42,
        }), 'Bearer test'));
    });

    it('submits unchanged enum values from English controls and shows saved editorial status in English', async () => {
        window.localStorage.setItem('vranjicreact.language', 'en');
        render(<LanguageProvider><MemoryRouter initialEntries={['/nase-malo-misto/vatrogasci/dodaj/prica']}><Routes>
            <Route path="/nase-malo-misto/:slug/dodaj/:kind?/:contentId?" element={<AreaContribution />} />
        </Routes></MemoryRouter></LanguageProvider>);
        await screen.findByRole('textbox', { name: 'Title *' });
        fireEvent.change(screen.getByRole('textbox', { name: 'Title *' }), { target: { value: 'Hrvatski naslov' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Summary *' }), { target: { value: 'Sažetak' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Content *' }), { target: { value: 'Hrvatski sadržaj' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'Perspective' }), { target: { value: 'Jucer' } });
        expect(screen.getByRole('option', { name: 'Yesterday' })).toHaveValue('Jucer');
        fireEvent.click(screen.getByRole('button', { name: 'Save story' }));
        expect(await screen.findByRole('button', { name: 'Submit for review' })).toBeInTheDocument();
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(createBlogPost).toHaveBeenCalledWith(expect.objectContaining({ areaId: 42, timePerspective: 'Jucer', title: 'Hrvatski naslov' }), 'Bearer test');
    });

    it('translates a server conflict and keeps the draft fields when the language changes', async () => {
        window.localStorage.setItem('vranjicreact.language', 'en');
        vi.mocked(createBlogPost).mockRejectedValueOnce(new Error('Sadržaj je u međuvremenu promijenjen. Osvježite podatke i pokušajte ponovno.'));
        render(<LanguageProvider><MemoryRouter initialEntries={['/nase-malo-misto/vatrogasci/dodaj/prica']}><LanguageSwitch /><Routes>
            <Route path="/nase-malo-misto/:slug/dodaj/:kind?/:contentId?" element={<AreaContribution />} />
        </Routes></MemoryRouter></LanguageProvider>);
        const title = await screen.findByRole('textbox', { name: 'Title *' });
        fireEvent.change(title, { target: { value: 'Sačuvaj me' } });
        fireEvent.submit(title.closest('form')!);
        expect(await screen.findByText('This content has changed. Refresh the data and try again.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Test HR' }));
        expect(screen.getByText('Sadržaj je u međuvremenu promijenjen. Osvježite podatke i pokušajte ponovno.')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Naslov *' })).toHaveValue('Sačuvaj me');
        expect(fetchArea).toHaveBeenCalledTimes(1);
    });

    it('localises story metadata and dates while keeping stored content in its original language', async () => {
        window.localStorage.setItem('vranjicreact.language', 'en');
        render(<LanguageProvider><MemoryRouter initialEntries={['/blog/izvorni-naslov']}><Routes>
            <Route path="/blog/:slug" element={<BlogDetalj />} />
        </Routes></MemoryRouter></LanguageProvider>);
        expect(await screen.findByRole('heading', { name: 'Obavijesti' })).toBeInTheDocument();
        expect(screen.getByText('Yesterday')).toBeInTheDocument();
        expect(screen.getByText('Danas')).toBeInTheDocument();
        expect(screen.getByText(new Date(story.publishedAt!).toLocaleDateString('en-GB'))).toBeInTheDocument();
    });

    it('switches stored article translations immediately without fetching again or calling Azure', async () => {
        vi.mocked(fetchBlogPostDetail).mockResolvedValue({ ...story, translations: [
            { language: 'en', fields: { title: 'English story', body: 'English body', excerpt: 'English summary' }, isStale: false, version: '1' },
        ] });
        render(<LanguageProvider><MemoryRouter initialEntries={['/blog/izvorni-naslov']}><LanguageSwitch /><Routes>
            <Route path="/blog/:slug" element={<BlogDetalj />} />
        </Routes></MemoryRouter></LanguageProvider>);
        expect(await screen.findByRole('heading', { name: 'Obavijesti' })).toBeInTheDocument();
        fireEvent.click(screen.getByText('Test EN'));
        expect(screen.getByRole('heading', { name: 'English story' })).toBeInTheDocument();
        expect(screen.getByText('English body')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Test HR'));
        expect(screen.getByRole('heading', { name: 'Obavijesti' })).toBeInTheDocument();
        expect(fetchBlogPostDetail).toHaveBeenCalledTimes(1);
        expect(translateText).not.toHaveBeenCalled();
    });

    it('saves HR and reviewed EN together through the existing news form', async () => {
        vi.mocked(translateText).mockImplementation(async text => ({ text: 'EN ' + text }));
        vi.mocked(fetchNewsDetail).mockResolvedValue({
            id: 12, title: 'HR naslov', slug: 'hr-naslov', excerpt: 'HR opis', body: 'HR tekst', tags: [],
            publishedAt: null, isFeatured: false, rowVersion: 'AQ==', canEdit: true, canSubmit: true, createdAt: '2026-01-01',
        });
        render(<LanguageProvider><MemoryRouter initialEntries={['/portal/news/12']}><Routes>
            <Route path="/portal/news/:id" element={<PortalNewsForm />} />
        </Routes></MemoryRouter></LanguageProvider>);
        fireEvent.click(await screen.findByText('Prevedi na engleski'));
        await waitFor(() => expect(screen.getByLabelText('Naslov (EN)')).toHaveValue('EN HR naslov'));
        expect(updateNews).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Naslov (EN)'), { target: { value: 'Reviewed English title' } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi objavu' }));
        await waitFor(() => expect(updateNews).toHaveBeenCalledWith(12, expect.objectContaining({
            title: 'HR naslov', body: 'HR tekst', rowVersion: 'AQ==',
            translations: [expect.objectContaining({ language: 'en', fields: { title: 'Reviewed English title', excerpt: 'EN HR opis', body: 'EN HR tekst' } })],
        }), 'Bearer test'));
    });
});
