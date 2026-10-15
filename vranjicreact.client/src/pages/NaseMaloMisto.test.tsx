import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PublicDisplayProvider } from '@/contexts/PublicDisplayContext';
import { apiFetch } from '@/lib/api-client';
import { fetchAreas } from '@/lib/classification-api';
import NaseMaloMisto from './NaseMaloMisto';

vi.mock('@/lib/api-client');
vi.mock('@/lib/classification-api');
function show(path = '/nase-malo-misto') {
    render(<LanguageProvider><PublicDisplayProvider><MemoryRouter initialEntries={[path]}><NaseMaloMisto /></MemoryRouter></PublicDisplayProvider></LanguageProvider>);
}
describe('Configured area preview', () => {
    beforeEach(() => {
        vi.clearAllMocks(); window.localStorage.clear();
        vi.mocked(apiFetch).mockResolvedValue({ initialAreaCount: 2 });
        vi.mocked(fetchAreas).mockResolvedValue(Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Područje ${index + 1}`, slug: `podrucje-${index + 1}`, sortOrder: index, isActive: true, createdAt: '2026-01-01' })));
    });
    it('uses the configured count, expands all areas and collapses again', async () => {
        show();
        await waitFor(() => expect(screen.getAllByRole('link', { name: 'Otvori područje →' })).toHaveLength(2));
        fireEvent.click(screen.getByRole('button', { name: 'Prikaži sve' }));
        expect(screen.getAllByRole('link', { name: 'Otvori područje →' })).toHaveLength(6);
        fireEvent.click(screen.getByRole('button', { name: 'Prikaži manje' }));
        expect(screen.getAllByRole('link', { name: 'Otvori područje →' })).toHaveLength(2);
    });
    it('opens all areas directly from the navigation link', async () => {
        show('/nase-malo-misto?all=1');
        await waitFor(() => expect(screen.getAllByRole('link', { name: 'Otvori područje →' })).toHaveLength(6));
    });
    it('keeps all areas accessible when settings fail', async () => {
        vi.mocked(apiFetch).mockRejectedValue(new Error('Offline'));
        show();
        expect(await screen.findByRole('status')).toHaveTextContent('Postavke prikaza nisu dostupne');
        await waitFor(() => expect(screen.getAllByRole('link', { name: 'Otvori područje →' })).toHaveLength(5));
        fireEvent.click(screen.getByRole('button', { name: 'Prikaži sve' }));
        expect(screen.getAllByRole('link', { name: 'Otvori područje →' })).toHaveLength(6);
    });
});
