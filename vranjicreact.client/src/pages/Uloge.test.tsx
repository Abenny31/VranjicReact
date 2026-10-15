import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { apiFetch } from '@/lib/api-client';
import PortalLayout from './portal/PortalLayout';
import Uloge from './Uloge';

const auth = vi.hoisted(() => ({
    status: 'authenticated', user: { id: 'reader', roles: ['Gost'] },
    getAccessToken: vi.fn(), hasRole: vi.fn(), logout: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api-client');

function show() {
    render(<LanguageProvider><MemoryRouter initialEntries={['/uloge']}><Routes>
        <Route path="/uloge" element={<ProtectedRoute requiredRoles={[]}><Uloge /></ProtectedRoute>} />
        <Route path="/login" element={<p>Prijava potrebna</p>} />
    </Routes></MemoryRouter></LanguageProvider>);
}

describe('Authenticated role descriptions', () => {
    beforeEach(() => {
        vi.clearAllMocks(); window.localStorage.clear(); auth.status = 'authenticated';
        auth.getAccessToken.mockResolvedValue('Bearer test'); auth.hasRole.mockReturnValue(false);
        vi.mocked(apiFetch).mockResolvedValue([{ name: 'Gost', capabilities: ['Pregled javno objavljenog sadržaja.'] }]);
    });

    it('redirects anonymous visitors to login without requesting role descriptions', async () => {
        auth.status = 'unauthenticated'; show();
        expect(await screen.findByText('Prijava potrebna')).toBeInTheDocument();
        expect(auth.getAccessToken).not.toHaveBeenCalled();
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('loads the same descriptions using the authenticated token, including for a reader', async () => {
        show();
        expect(await screen.findByRole('heading', { name: 'Gost' })).toBeInTheDocument();
        expect(apiFetch).toHaveBeenCalledWith('/api/roles', expect.objectContaining({ headers: { Authorization: 'Bearer test' }, signal: expect.any(AbortSignal) }));
    });

    it('does not fall back to an anonymous request if the session expires, and retries with a valid token', async () => {
        auth.getAccessToken.mockResolvedValueOnce(null); show();
        expect(await screen.findByRole('alert')).toHaveTextContent('Opisi uloga trenutačno nisu dostupni.');
        expect(apiFetch).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovno' }));
        expect(await screen.findByRole('heading', { name: 'Gost' })).toBeInTheDocument();
    });

    it('offers the roles link in portal navigation', () => {
        render(<LanguageProvider><MemoryRouter><PortalLayout /></MemoryRouter></LanguageProvider>);
        expect(screen.getByRole('link', { name: 'Uloge' })).toHaveAttribute('href', '/uloge');
    });
});
