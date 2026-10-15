import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalUsersList from './PortalUsersList';
import PortalContactMessages from './PortalContactMessages';
import PortalModeratorAssignments from './PortalModeratorAssignments';
import { approveUser, deleteUser, fetchUsersPage, resendInvitation } from '@/lib/account-api';
import { fetchContactMessagesPage, markContactProcessed, setContactArchive } from '@/lib/contact-api';
import { fetchAreas } from '@/lib/classification-api';
import { fetchModeratorAssignmentsPage, saveModeratorAssignment, deactivateModeratorAssignment } from '@/lib/moderation-api';
import type { ContactMessage, UserListItem } from '@/lib/types';
import type { ListPage } from '@/lib/api-client';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn(), hasRole: vi.fn(), user: { id: 'self' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback, language: 'hr' }) }));
vi.mock('@/lib/account-api', () => ({ fetchUsersPage: vi.fn(), deleteUser: vi.fn(), approveUser: vi.fn(), resendInvitation: vi.fn() }));
vi.mock('@/lib/contact-api', () => ({ fetchContactMessagesPage: vi.fn(), markContactProcessed: vi.fn(), setContactArchive: vi.fn() }));
vi.mock('@/lib/classification-api', () => ({ fetchAreas: vi.fn() }));
vi.mock('@/lib/moderation-api', () => ({ fetchModeratorAssignmentsPage: vi.fn(), saveModeratorAssignment: vi.fn(), deactivateModeratorAssignment: vi.fn() }));

const user = (id: string, roles = ['Moderator']): UserListItem => ({ id, email: `${id}@example.test`, emailConfirmed: false, roles });
const message = (id: number): ContactMessage => ({ id, name: `Sender ${id}`, email: `${id}@example.test`, message: `Body ${id}`, submittedAt: '2026-01-01T10:00:00Z', processedAt: null, archived: false });

describe('Administrative lists', () => {
    it('displays and searches by nickname while retaining the account email', async () => {
        vi.mocked(fetchUsersPage).mockResolvedValue({ items: [{ ...user('person'), nickname: 'Ante' }], hasMore: false });
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        expect(await screen.findByText('Ante')).toBeInTheDocument();
        expect(screen.getByText('person@example.test')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Email, korisničko ime ili nadimak'), { target: { value: 'Ante' } });
        fireEvent.click(screen.getByRole('button', { name: 'Pretraži' }));
        await waitFor(() => expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Ante', page: 1 })));
    });

    it('hides deletion for a protected seed account even from another SuperUser', async () => {
        vi.mocked(fetchUsersPage).mockResolvedValue({ items: [{ ...user('seed', ['SuperUser']), emailConfirmed: true, isProtected: true }], hasMore: false });
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        await screen.findByText('seed@example.test');
        expect(screen.getByText('Zaštićeni početni račun')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Obrisi' })).not.toBeInTheDocument();
    });

    it('resends a pending invitation instead of offering manual email confirmation', async () => {
        vi.mocked(fetchUsersPage).mockResolvedValue({ items: [{ ...user('invited'), invitationPending: true }], hasMore: false });
        vi.mocked(resendInvitation).mockResolvedValue({ userId: 'invited', emailSent: true, message: 'Pozivnica je poslana.' });
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        fireEvent.click(await screen.findByRole('button', { name: 'Ponovno pošalji pozivnicu' }));
        expect(screen.queryByRole('button', { name: 'Odobri' })).not.toBeInTheDocument();
        await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith('invited', 'Bearer test'));
        expect(await screen.findByText('Pozivnica je poslana.')).toBeInTheDocument();
    });

    beforeEach(() => {
        vi.resetAllMocks();
        auth.getAccessToken.mockResolvedValue('Bearer test');
        auth.hasRole.mockImplementation((role: string) => role === 'SuperUser');
        vi.mocked(fetchUsersPage).mockResolvedValue({ items: [user('first')], hasMore: true });
        vi.mocked(fetchContactMessagesPage).mockResolvedValue({ items: [message(1)], hasMore: true });
        vi.mocked(fetchModeratorAssignmentsPage).mockResolvedValue({ items: [], hasMore: false });
        vi.mocked(fetchAreas).mockResolvedValue([{ id: 1, name: 'Area', slug: 'area', isActive: true, sortOrder: 0, createdAt: '2026-01-01T00:00:00Z' }]);
    });

    it('shows loading and retry without reporting a failed user request as an empty list', async () => {
        let reject!: (reason: Error) => void;
        vi.mocked(fetchUsersPage).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        expect(screen.getByRole('status')).toBeInTheDocument();
        await waitFor(() => expect(fetchUsersPage).toHaveBeenCalledOnce());
        await act(async () => { reject(new Error('Load failed')); });
        expect(screen.getByRole('alert')).toHaveTextContent('Load failed');
        expect(screen.queryByText('Nema registriranih korisnika.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovno' }));
        expect(await screen.findByText('first@example.test')).toBeInTheDocument();
    });

    it('resets users to page one on search and applies status and role filters on the server', async () => {
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        await screen.findByText('first@example.test');
        fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
        await waitFor(() => expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
        fireEvent.change(screen.getByRole('textbox', { name: 'Pretraga korisnika' }), { target: { value: ' older ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Pretraži' }));
        await waitFor(() => expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'older' })));
        fireEvent.change(screen.getByRole('combobox', { name: 'Status korisnika' }), { target: { value: 'pending' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'Uloga' }), { target: { value: 'Moderator' } });
        await waitFor(() => expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, emailConfirmed: false, role: 'Moderator' })));
    });

    it('returns to the previous page after deleting its final user', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.mocked(deleteUser).mockResolvedValue(undefined);
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        await screen.findByText('first@example.test');
        fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
        await screen.findByText('first@example.test');
        await waitFor(() => expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
        fireEvent.click(screen.getByRole('button', { name: 'Obrisi' }));
        await waitFor(() => expect(deleteUser).toHaveBeenCalledWith('first', 'Bearer test'));
        await waitFor(() => expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
        confirm.mockRestore();
    });

    it('hides SuperUser-only actions and cannot offer administrator deletion of a SuperUser', async () => {
        auth.hasRole.mockImplementation((role: string) => role === 'Administrator');
        vi.mocked(fetchUsersPage).mockResolvedValue({ items: [user('owner', ['SuperUser'])], hasMore: false });
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        await screen.findByText('owner@example.test');
        expect(screen.queryByRole('button', { name: 'Odobri' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Uredi' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Obrisi' })).not.toBeInTheDocument();
    });

    it('reloads pending users after approval instead of retaining a row outside the filter', async () => {
        vi.mocked(approveUser).mockResolvedValue({ ...user('first'), emailConfirmed: true });
        render(<MemoryRouter><PortalUsersList /></MemoryRouter>);
        await screen.findByText('first@example.test');
        fireEvent.change(screen.getByRole('combobox', { name: 'Status korisnika' }), { target: { value: 'pending' } });
        await screen.findByText('first@example.test');
        vi.mocked(fetchUsersPage).mockResolvedValue({ items: [], hasMore: false });
        fireEvent.click(screen.getByRole('button', { name: 'Odobri' }));
        expect(await screen.findByText('Nema registriranih korisnika.')).toBeInTheDocument();
        expect(approveUser).toHaveBeenCalledWith('first', 'Bearer test');
    });

    it('filters pending contact messages server-side and moves back after processing the last row', async () => {
        vi.mocked(markContactProcessed).mockResolvedValue(undefined);
        render(<PortalContactMessages />);
        await screen.findByText('Sender 1');
        fireEvent.click(screen.getByRole('button', { name: 'Neobrađene' }));
        await waitFor(() => expect(fetchContactMessagesPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, archived: false, processed: false })));
        await screen.findByText('Sender 1');
        fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
        await waitFor(() => expect(fetchContactMessagesPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
        await screen.findByText('Sender 1');
        fireEvent.click(screen.getByRole('button', { name: 'Obradi' }));
        await waitFor(() => expect(markContactProcessed).toHaveBeenCalledWith(1, 'Bearer test'));
        await waitFor(() => expect(fetchContactMessagesPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, processed: false })));
    });

    it('ignores an old contact response after changing search', async () => {
        let resolveOld!: (value: ListPage<ContactMessage>) => void;
        vi.mocked(fetchContactMessagesPage).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
            .mockResolvedValue({ items: [message(2)], hasMore: false });
        render(<PortalContactMessages />);
        await waitFor(() => expect(fetchContactMessagesPage).toHaveBeenCalledOnce());
        const oldSignal = vi.mocked(fetchContactMessagesPage).mock.calls[0][0].signal;
        fireEvent.change(screen.getByRole('textbox', { name: 'Pretraga poruka' }), { target: { value: 'Body 2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Pretraži' }));
        await screen.findByText('Sender 2');
        expect(oldSignal?.aborted).toBe(true);
        await act(async () => { resolveOld({ items: [message(1)], hasMore: true }); });
        expect(screen.queryByText('Sender 1')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sljedeća' })).toBeDisabled();
    });

    it('preserves a contact row and search input when an action fails', async () => {
        vi.mocked(setContactArchive).mockRejectedValue(new Error('Archive failed'));
        render(<PortalContactMessages />);
        await screen.findByText('Sender 1');
        fireEvent.change(screen.getByRole('textbox', { name: 'Pretraga poruka' }), { target: { value: 'unsent query' } });
        fireEvent.click(screen.getByRole('button', { name: 'Arhiviraj' }));
        expect(await screen.findByText('Archive failed')).toBeInTheDocument();
        expect(screen.getByText('Sender 1')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Pretraga poruka' })).toHaveValue('unsent query');
    });

    it('keeps an explicitly selected moderator when searching another page and submits that ID', async () => {
        vi.mocked(fetchUsersPage).mockResolvedValueOnce({ items: [user('first')], hasMore: true })
            .mockResolvedValue({ items: [user('older')], hasMore: false });
        render(<PortalModeratorAssignments />);
        await screen.findByRole('option', { name: 'first@example.test' });
        fireEvent.change(screen.getByRole('combobox', { name: 'Moderator' }), { target: { value: 'first' } });
        fireEvent.click(within(screen.getByLabelText('Straničenje moderatora')).getByRole('button', { name: 'Sljedeća' }));
        await screen.findByRole('option', { name: 'older@example.test' });
        expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, role: 'Moderator' }));
        expect(screen.getByRole('combobox', { name: 'Moderator' })).toHaveValue('first');
        fireEvent.change(screen.getByRole('textbox', { name: 'Pretraga moderatora' }), { target: { value: 'older' } });
        fireEvent.click(screen.getByRole('button', { name: 'Pretraži' }));
        await waitFor(() => expect(fetchUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'older', role: 'Moderator' })));
        await screen.findByRole('option', { name: 'older@example.test' });
        fireEvent.change(screen.getByRole('combobox', { name: 'Područje' }), { target: { value: '1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Spremi dodjelu' }));
        await waitFor(() => expect(saveModeratorAssignment).toHaveBeenCalledWith({ userId: 'first', areaId: 1, endsAt: null }, 'Bearer test'));
    });

    it('blocks moderator selection on failed lookup and supports retry', async () => {
        vi.mocked(fetchUsersPage).mockRejectedValueOnce(new Error('Lookup failed'));
        render(<PortalModeratorAssignments />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Lookup failed');
        expect(screen.getByRole('button', { name: 'Spremi dodjelu' })).toBeDisabled();
        expect(screen.getByRole('combobox', { name: 'Moderator' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovno' }));
        expect(await screen.findByRole('option', { name: 'first@example.test' })).toBeInTheDocument();
    });

    it('filters expired assignments, shows their status and returns a page after deactivation', async () => {
        vi.mocked(fetchModeratorAssignmentsPage).mockResolvedValue({ items: [{ id: 99, userId: 'first', userEmail: 'first@example.test',
            area: { id: 1, name: 'Area', slug: 'area' }, isActive: true, status: 'Expired', assignedAt: '2025-01-01T00:00:00Z', endsAt: '2025-02-01T00:00:00Z' }], hasMore: true });
        vi.mocked(deactivateModeratorAssignment).mockResolvedValue(undefined);
        render(<PortalModeratorAssignments />);
        await screen.findByText('Isteklo');
        fireEvent.change(screen.getByRole('combobox', { name: 'Status dodjele' }), { target: { value: 'expired' } });
        await waitFor(() => expect(fetchModeratorAssignmentsPage).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'expired', page: 1 })));
        await screen.findByText('Isteklo');
        fireEvent.click(within(screen.getByLabelText('Straničenje dodjela')).getByRole('button', { name: 'Sljedeća' }));
        await screen.findByText('Isteklo');
        fireEvent.click(screen.getByRole('button', { name: 'Deaktiviraj' }));
        await waitFor(() => expect(deactivateModeratorAssignment).toHaveBeenCalledWith(99, 'Bearer test'));
        await waitFor(() => expect(fetchModeratorAssignmentsPage).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'expired', page: 1 })));
    });
});
