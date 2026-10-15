import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import Login from './Login';

const auth = vi.hoisted(() => ({
    status: 'unauthenticated', user: { roles: ['Gost'] }, login: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PublicContactContext', () => ({ usePublicContact: () => ({
    contact: { supportEmail: 'configured-support@example.test' }, loading: false, error: false,
}) }));

function show() {
    render(<LanguageProvider><MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/uloge' } } }]}><Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/uloge" element={<p>Opisi uloga</p>} />
    </Routes></MemoryRouter></LanguageProvider>);
}

async function submit() {
    fireEvent.click(screen.getByRole('button', { name: 'Prijavi se' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prijavi se' })).toBeEnabled());
}

describe('Login support visibility', () => {
    beforeEach(() => {
        vi.clearAllMocks(); window.localStorage.clear(); auth.status = 'unauthenticated';
        auth.login.mockRejectedValue(new Error('Failed'));
    });

    it('shows a discreet configured support link only after ten failures and resets after success', async () => {
        show();
        fireEvent.change(screen.getByRole('textbox', { name: 'Email adresa' }), { target: { value: 'test@example.test' } });
        fireEvent.change(screen.getByLabelText('Lozinka', { selector: 'input' }), { target: { value: 'incorrect' } });
        expect(screen.queryByRole('link', { name: 'Kontaktirajte administratora' })).not.toBeInTheDocument();
        for (let attempt = 0; attempt < 9; attempt++) await submit();
        expect(auth.login).toHaveBeenCalledTimes(9);
        expect(screen.queryByRole('link', { name: 'Kontaktirajte administratora' })).not.toBeInTheDocument();
        await submit();
        expect(auth.login).toHaveBeenCalledTimes(10);
        expect(screen.getByRole('link', { name: 'Kontaktirajte administratora' })).toHaveAttribute('href', 'mailto:configured-support@example.test');
        expect(screen.queryByText('configured-support@example.test')).not.toBeInTheDocument();
        auth.login.mockResolvedValueOnce(undefined);
        await submit();
        expect(screen.queryByRole('link', { name: 'Kontaktirajte administratora' })).not.toBeInTheDocument();
        await submit();
        expect(screen.queryByRole('link', { name: 'Kontaktirajte administratora' })).not.toBeInTheDocument();
    });

    it('returns an authenticated reader to roles without granting access to other portal features', async () => {
        auth.status = 'authenticated';
        show();
        expect(await screen.findByText('Opisi uloga')).toBeInTheDocument();
        expect(auth.login).not.toHaveBeenCalled();
    });
});
