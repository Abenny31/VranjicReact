import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { fetchBlogPostsPage } from '@/lib/blog-api';
import { fetchAreas, fetchTags } from '@/lib/classification-api';
import Blog from './Blog';

vi.mock('@/lib/blog-api');
vi.mock('@/lib/classification-api');
function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Test back</button>; }
it('restores story filters and page from the URL, resets page on changes and supports back navigation', async () => {
    window.localStorage.clear();
    vi.mocked(fetchAreas).mockResolvedValue([{ id: 1, name: 'Mačkare', slug: 'mackare', sortOrder: 0, isActive: true, createdAt: '2026-01-01' }]);
    vi.mocked(fetchTags).mockResolvedValue([]);
    vi.mocked(fetchBlogPostsPage).mockResolvedValue({ items: [], hasMore: false });
    render(<LanguageProvider><MemoryRouter initialEntries={['/blog?area=mackare&perspective=Jucer&page=3']}><Blog /><Back /></MemoryRouter></LanguageProvider>);
    await waitFor(() => expect(fetchBlogPostsPage).toHaveBeenLastCalledWith(expect.objectContaining({ area: 'mackare', perspective: 'Jucer', page: 3 })));
    fireEvent.change(screen.getByRole('combobox', { name: 'Vremenska perspektiva' }), { target: { value: 'Danas' } });
    await waitFor(() => expect(fetchBlogPostsPage).toHaveBeenLastCalledWith(expect.objectContaining({ area: 'mackare', perspective: 'Danas', page: 1 })));
    fireEvent.click(screen.getByRole('button', { name: 'Test back' }));
    await waitFor(() => expect(fetchBlogPostsPage).toHaveBeenLastCalledWith(expect.objectContaining({ area: 'mackare', perspective: 'Jucer', page: 3 })));
});

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ status: 'unauthenticated', hasRole: () => false }) }));
