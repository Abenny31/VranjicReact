import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AcceptInvitation from './AcceptInvitation';
import PortalUserForm from './portal/PortalUserForm';
import PortalUserEditForm from './portal/PortalUserEditForm';
import { acceptInvitation, createUser, fetchInvitationAvailability, fetchUser, inviteUser, updateUser } from '@/lib/account-api';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test'), hasRole: vi.fn(() => true) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('@/lib/account-api');

function UsersDestination() {
    const location = useLocation();
    return <p role="status">Lista korisnika: {(location.state as { successMessage?: string })?.successMessage}</p>;
}

function renderCreateRoute() {
    render(<MemoryRouter initialEntries={['/portal/users/new']}><Routes>
        <Route path="portal">
            <Route index element={<p>Pogrešno odredište</p>} />
            <Route path="users" element={<UsersDestination />} />
            <Route path="users/new" element={<PortalUserForm />} />
        </Route>
    </Routes></MemoryRouter>);
}

describe('Invitation forms', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.hasRole.mockReturnValue(true);
        vi.mocked(fetchInvitationAvailability).mockResolvedValue({ enabled: false });
    });

    it('keeps manual creation available and hides invitations while mail is disabled', async () => {
        render(<MemoryRouter><PortalUserForm /></MemoryRouter>);
        await waitFor(() => expect(fetchInvitationAvailability).toHaveBeenCalledWith('Bearer test'));
        expect(screen.getByLabelText('Lozinka *')).toBeInTheDocument();
        expect(screen.queryByLabelText(/Pošalji pozivnicu e-mailom/)).not.toBeInTheDocument();
    });

    it('returns to the user list with a success message after manual creation', async () => {
        vi.mocked(createUser).mockResolvedValue({ id: 'created', email: 'person@example.test', emailConfirmed: false, roles: [] });
        renderCreateRoute();
        fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'person@example.test' } });
        for (const name of ['Lozinka *', 'Potvrda lozinke *']) fireEvent.change(screen.getByLabelText(name), { target: { value: 'password9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi korisnika' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Lista korisnika: Korisnik je uspješno dodan.');
        expect(createUser).toHaveBeenCalledWith({ email: 'person@example.test', password: 'password9', confirmEmail: false, roles: [] }, 'Bearer test');
    });

    it('includes a trimmed nickname when creating an account', async () => {
        vi.mocked(createUser).mockResolvedValue({ id: 'created', email: 'person@example.test', nickname: 'Ante', emailConfirmed: false, roles: [] });
        renderCreateRoute();
        fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'person@example.test' } });
        fireEvent.change(screen.getByLabelText('Nadimak'), { target: { value: ' Ante ' } });
        for (const name of ['Lozinka *', 'Potvrda lozinke *']) fireEvent.change(screen.getByLabelText(name), { target: { value: 'password9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi korisnika' }));
        await screen.findByRole('status');
        expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Ante', email: 'person@example.test' }), 'Bearer test');
    });

    it('loads a nickname and allows explicitly clearing it without changing roles', async () => {
        vi.mocked(fetchUser).mockResolvedValue({ id: 'person', email: 'person@example.test', nickname: 'Ante', emailConfirmed: true, roles: ['Korisnik'] });
        vi.mocked(updateUser).mockResolvedValue({ id: 'person', email: 'person@example.test', nickname: null, emailConfirmed: true, roles: ['Korisnik'] });
        render(<MemoryRouter initialEntries={['/portal/users/person/edit']}><Routes>
            <Route path="/portal/users/:id/edit" element={<PortalUserEditForm />} />
            <Route path="/portal/users" element={<UsersDestination />} />
        </Routes></MemoryRouter>);
        expect(await screen.findByLabelText('Nadimak')).toHaveValue('Ante');
        fireEvent.change(screen.getByLabelText('Nadimak'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi korisnika' }));
        await screen.findByRole('status');
        expect(updateUser).toHaveBeenCalledWith('person', { email: 'person@example.test', emailConfirmed: true, nickname: '', roles: ['Korisnik'] }, 'Bearer test');
    });

    it('preserves the form and passwords when creation fails', async () => {
        vi.mocked(createUser).mockRejectedValue(new Error('Email je zauzet.'));
        renderCreateRoute();
        fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'person@example.test' } });
        for (const name of ['Lozinka *', 'Potvrda lozinke *']) fireEvent.change(screen.getByLabelText(name), { target: { value: 'password9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi korisnika' }));
        expect(await screen.findByText('Email je zauzet.')).toBeInTheDocument();
        expect(screen.getByLabelText('Lozinka *')).toHaveValue('password9');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('returns to the list after a successfully sent invitation', async () => {
        vi.mocked(fetchInvitationAvailability).mockResolvedValue({ enabled: true });
        vi.mocked(inviteUser).mockResolvedValue({ userId: 'id', emailSent: true, message: 'Pozivnica je poslana.' });
        renderCreateRoute();
        fireEvent.click(await screen.findByLabelText(/Pošalji pozivnicu e-mailom/));
        fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'person@example.test' } });
        fireEvent.click(screen.getByLabelText('Korisnik (4)'));
        fireEvent.change(screen.getByLabelText('Nadimak'), { target: { value: 'Ante' } });
        fireEvent.click(screen.getByRole('button', { name: 'Pošalji pozivnicu' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Lista korisnika: Pozivnica je poslana.');
        expect(inviteUser).toHaveBeenCalledWith({ email: 'person@example.test', roles: ['Korisnik'], nickname: 'Ante' }, 'Bearer test');
    });

    it('sends selected roles without a password and reports an email delivery failure', async () => {
        vi.mocked(fetchInvitationAvailability).mockResolvedValue({ enabled: true });
        vi.mocked(inviteUser).mockResolvedValue({ userId: 'id', emailSent: false, message: 'Račun je pripremljen, ali e-mail nije poslan. Ponovno pošaljite pozivnicu iz popisa korisnika.' });
        renderCreateRoute();
        fireEvent.click(await screen.findByLabelText(/Pošalji pozivnicu e-mailom/));
        expect(screen.queryByLabelText('Lozinka *')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'person@example.test' } });
        fireEvent.click(screen.getByLabelText('Korisnik (4)'));
        fireEvent.click(screen.getByRole('button', { name: 'Pošalji pozivnicu' }));
        await waitFor(() => expect(inviteUser).toHaveBeenCalledWith({ email: 'person@example.test', roles: ['Korisnik'] }, 'Bearer test'));
        expect(await screen.findByRole('status')).toHaveTextContent('e-mail nije poslan');
        expect(screen.getByRole('button', { name: 'Povratak na korisnike' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Povratak na korisnike' }));
        expect(screen.getByRole('status')).toHaveTextContent('Lista korisnika:');
    });

    it('does not offer invitation access to an administrator', () => {
        auth.hasRole.mockReturnValue(false);
        render(<MemoryRouter><PortalUserForm /></MemoryRouter>);
        expect(fetchInvitationAvailability).not.toHaveBeenCalled();
        expect(screen.queryByLabelText(/Pošalji pozivnicu e-mailom/)).not.toBeInTheDocument();
    });

    it('shows protected seed controls without allowing removal of its role or confirmation', async () => {
        vi.mocked(fetchUser).mockResolvedValue({ id: 'seed', email: 'seed@example.test', emailConfirmed: true, roles: ['SuperUser'], isProtected: true });
        render(<MemoryRouter initialEntries={['/seed']}><Routes><Route path="/:id" element={<PortalUserEditForm />} /></Routes></MemoryRouter>);
        expect(await screen.findByLabelText('SuperUser (1)')).toBeDisabled();
        expect(screen.getByLabelText('Oznaci email kao potvrden (odobrenje nije potrebno)')).toBeDisabled();
    });

    it('rejects an incomplete invitation URL', () => {
        render(<MemoryRouter><AcceptInvitation /></MemoryRouter>);
        expect(screen.getByRole('alert')).toHaveTextContent('Pozivnica nije valjana');
        expect(screen.queryByRole('button', { name: 'Aktiviraj račun' })).not.toBeInTheDocument();
    });

    it('checks password confirmation and activates using the fragment token', async () => {
        vi.mocked(acceptInvitation).mockResolvedValue(undefined);
        render(<MemoryRouter initialEntries={['/prihvati-pozivnicu#userId=id&token=test%2Btoken']}><AcceptInvitation /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Nova lozinka'), { target: { value: 'password9' } });
        fireEvent.change(screen.getByLabelText('Potvrda nove lozinke'), { target: { value: 'different9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aktiviraj račun' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Lozinke se ne podudaraju.');
        expect(acceptInvitation).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Potvrda nove lozinke'), { target: { value: 'password9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aktiviraj račun' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Račun je aktiviran.');
        expect(acceptInvitation).toHaveBeenCalledWith({ userId: 'id', token: 'test+token', password: 'password9' });
        expect(screen.getByRole('link', { name: 'Prijavi se' })).toHaveAttribute('href', '/login');
    });

    it('shows a server rejection without claiming activation succeeded', async () => {
        vi.mocked(acceptInvitation).mockRejectedValue(new Error('Pozivnica nije valjana ili je istekla. Zatražite novu pozivnicu.'));
        render(<MemoryRouter initialEntries={['/prihvati-pozivnicu#userId=id&token=expired']}><AcceptInvitation /></MemoryRouter>);
        for (const name of ['Nova lozinka', 'Potvrda nove lozinke']) fireEvent.change(screen.getByLabelText(name), { target: { value: 'password9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Aktiviraj račun' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('istekla');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
