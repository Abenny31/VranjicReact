import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { fetchMyContent } from '@/lib/my-content-api';
import PortalDashboard from './PortalDashboard';

const auth = vi.hoisted(() => ({ status: 'authenticated', getAccessToken: vi.fn().mockResolvedValue('Bearer test'), hasRole: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/my-content-api');
beforeEach(() => {
    vi.clearAllMocks();
    auth.hasRole.mockImplementation((role: string) => role === 'Korisnik');
    localStorage.clear();
});
const show = () => render(<LanguageProvider><MemoryRouter><PortalDashboard /></MemoryRouter></LanguageProvider>);

it('offers three creation actions and shows saved content with status and paging', async () => {
    vi.mocked(fetchMyContent).mockResolvedValue({ page: 1, hasMore: true, items: [{ id: 73, contentType: 'Blog', title: 'Moja priča',
        editorialStatus: 'Draft', rowVersion: 'AQ==', canEdit: true, canSubmit: true, lastChangedAt: '2026-10-14' }] });
    show();
    expect(await screen.findByText('Moja priča')).toBeInTheDocument();
    expect(screen.getByText('Nacrt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dodaj priču' })).toHaveAttribute('href', '/dodaj/prica?from=portal');
    expect(screen.getByRole('link', { name: 'Nova objava' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dodaj fotografije' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nastavi uređivati' })).toHaveAttribute('href', '/portal/blog/73/edit');
    vi.mocked(fetchMyContent).mockResolvedValue({ page: 2, hasMore: false, items: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Sljedeća' }));
    await waitFor(() => expect(fetchMyContent).toHaveBeenLastCalledWith(2, 'Bearer test', expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sljedeća' })).toBeDisabled());
});

it('supports retry and does not request creator content for a reviewer', async () => {
    vi.mocked(fetchMyContent).mockRejectedValueOnce(new Error('Privremena greška.'));
    const view = show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Privremena greška.');
    vi.mocked(fetchMyContent).mockResolvedValue({ page: 1, items: [], hasMore: false });
    fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovno' }));
    expect(await screen.findByText(/Još nemate vlastitih objava/)).toBeInTheDocument();
    view.unmount(); vi.clearAllMocks(); auth.hasRole.mockReturnValue(false);
    show();
    expect(screen.queryByRole('link', { name: 'Dodaj priču' })).not.toBeInTheDocument();
    expect(fetchMyContent).not.toHaveBeenCalled();
});
