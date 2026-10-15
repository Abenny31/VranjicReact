import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';
import { AREAS_CHANGED_EVENT, fetchAreas } from '@/lib/classification-api';
import type { Area } from '@/lib/types';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ status: 'unauthenticated', hasRole: () => false }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback, language: 'hr', setLanguage: vi.fn() }) }));
vi.mock('@/lib/classification-api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/classification-api')>(), fetchAreas: vi.fn() }));

const area: Area = { id: 2, name: 'Vatrogasci', slug: 'vatrogasci', sortOrder: 1, isActive: true, createdAt: '2026-01-01' };
describe('Area navigation refresh', () => {
    beforeEach(() => { vi.mocked(fetchAreas).mockReset(); });
    it.each([false, true])('keeps the saved area order after refresh (mobile menu: %s)', async mobile => {
        const otherArea: Area = { ...area, id: 3, name: 'Kultura', slug: 'kultura', sortOrder: 2 };
        vi.mocked(fetchAreas).mockResolvedValue([area, otherArea]);
        render(<MemoryRouter><Header /></MemoryRouter>);
        if (mobile) fireEvent.click(screen.getByRole('button', { name: 'Toggle Menu' }));
        fireEvent.click(screen.getByRole('button', { name: 'Otvori izbornik Naše malo misto' }));
        await screen.findByRole('link', { name: 'Vatrogasci' });
        const submenu = screen.getByRole('list', { name: 'Podizbornik Naše malo misto' });
        expect(within(submenu).getAllByRole('link').map(link => link.textContent)).toEqual(['Vatrogasci', 'Kultura', 'Prikaži sve']);
        vi.mocked(fetchAreas).mockResolvedValue([{ ...otherArea, sortOrder: 0 }, area]);
        act(() => { window.dispatchEvent(new Event(AREAS_CHANGED_EVENT)); });
        await waitFor(() => expect(within(submenu).getAllByRole('link').map(link => link.textContent)).toEqual(['Kultura', 'Vatrogasci', 'Prikaži sve']));
    });
    it('refreshes visible area names after mutation and removes deactivated areas', async () => {
        vi.mocked(fetchAreas).mockResolvedValue([]);
        render(<MemoryRouter><Header /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Otvori izbornik Naše malo misto' }));
        vi.mocked(fetchAreas).mockResolvedValue([area]);
        act(() => { window.dispatchEvent(new Event(AREAS_CHANGED_EVENT)); });
        expect(await screen.findByRole('link', { name: 'Vatrogasci' })).toHaveAttribute('href', '/nase-malo-misto/vatrogasci');
        vi.mocked(fetchAreas).mockResolvedValue([]);
        act(() => { window.dispatchEvent(new Event(AREAS_CHANGED_EVENT)); });
        await waitFor(() => expect(screen.queryByRole('link', { name: 'Vatrogasci' })).not.toBeInTheDocument());
    });
    it('does not overwrite refreshed areas with an older response and aborts on unmount', async () => {
        let resolveOld!: (areas: Area[]) => void;
        vi.mocked(fetchAreas).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue([area]);
        const view = render(<MemoryRouter><Header /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Otvori izbornik Naše malo misto' }));
        act(() => { window.dispatchEvent(new Event('focus')); });
        expect(await screen.findByRole('link', { name: 'Vatrogasci' })).toBeInTheDocument();
        await act(async () => { resolveOld([]); });
        expect(screen.getByRole('link', { name: 'Vatrogasci' })).toBeInTheDocument();
        const latestSignal = vi.mocked(fetchAreas).mock.calls.at(-1)![0]!;
        view.unmount();
        expect(latestSignal.aborted).toBe(true);
        const calls = vi.mocked(fetchAreas).mock.calls.length;
        window.dispatchEvent(new Event(AREAS_CHANGED_EVENT));
        expect(fetchAreas).toHaveBeenCalledTimes(calls);
    });
});
