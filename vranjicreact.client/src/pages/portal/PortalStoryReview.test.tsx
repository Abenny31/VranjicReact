import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { CONTENT_VERIFY_ROLES } from '@/lib/auth-roles';
import { fetchBlogPostDetail, verifyBlogPost } from '@/lib/blog-api';
import type { BlogPostDetail } from '@/lib/types';
import PortalStoryReview from './PortalStoryReview';

const auth = vi.hoisted(() => ({ status: 'authenticated', user: { id: 'verifier', roles: ['Provjeravatelj'] }, getAccessToken: vi.fn().mockResolvedValue('Bearer test') }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ ...auth, hasRole: (role: string) => auth.user.roles.includes(role) }) }));
vi.mock('@/lib/blog-api');
const story: BlogPostDetail = {
    id: 7, title: 'Priča za provjeru', slug: 'prica', excerpt: 'Sažetak', body: 'Tekst koji treba provjeriti.',
    isFeatured: false, publishedAt: null, createdAt: '2026-01-01', tags: [], rowVersion: 'AQ==', canEdit: false, canSubmit: false, editorialStatus: 'Draft',
    sources: [{ id: 1, title: 'Arhivski dokument', type: 'Document' }],
};
function show() {
    render(<LanguageProvider><MemoryRouter initialEntries={['/portal/blog/7/review']}><Routes>
        <Route path="/portal/blog/:id/review" element={<ProtectedRoute requiredRoles={CONTENT_VERIFY_ROLES} redirectTo="/portal/blog"><PortalStoryReview /></ProtectedRoute>} />
        <Route path="/portal/blog" element={<p>Lista priča</p>} />
    </Routes></MemoryRouter></LanguageProvider>);
}
describe('Verifier review', () => {
    beforeEach(() => {
        vi.clearAllMocks(); window.localStorage.clear(); auth.user.roles = ['Provjeravatelj'];
        vi.mocked(fetchBlogPostDetail).mockResolvedValue(story);
    });
    afterEach(() => vi.restoreAllMocks());
    it('allows an existing verifier to inspect text and sources before confirming verification', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
        vi.mocked(verifyBlogPost).mockResolvedValue({ ...story, origin: 'DocumentedAndVerified' });
        show();
        expect(await screen.findByText(story.body)).toBeInTheDocument();
        expect(screen.getByText('Arhivski dokument')).toBeInTheDocument();
        expect(fetchBlogPostDetail).toHaveBeenCalledWith('7', expect.objectContaining({ authorization: 'Bearer test', includeUnpublished: true }));
        expect(screen.queryByRole('button', { name: /Spremi priču|Objavi/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Označi kao dokumentirano i provjereno' }));
        expect(verifyBlogPost).not.toHaveBeenCalled();
        vi.mocked(fetchBlogPostDetail).mockResolvedValue({ ...story, origin: 'DocumentedAndVerified' });
        fireEvent.click(screen.getByRole('button', { name: 'Označi kao dokumentirano i provjereno' }));
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Priča je označena'));
        expect(verifyBlogPost).toHaveBeenCalledWith(7, 'Bearer test');
        expect(confirm).toHaveBeenCalledTimes(2);
    });
    it('blocks verification without sources', async () => {
        vi.mocked(fetchBlogPostDetail).mockResolvedValue({ ...story, sources: [] });
        show();
        expect(await screen.findByRole('button', { name: 'Označi kao dokumentirano i provjereno' })).toBeDisabled();
        expect(verifyBlogPost).not.toHaveBeenCalled();
    });
    it('does not grant verifier access to a moderator or contributor', async () => {
        auth.user.roles = ['Moderator', 'Korisnik'];
        show();
        await waitFor(() => expect(screen.getByText('Lista priča')).toBeInTheDocument());
        expect(fetchBlogPostDetail).not.toHaveBeenCalled();
        expect(verifyBlogPost).not.toHaveBeenCalled();
    });
});
