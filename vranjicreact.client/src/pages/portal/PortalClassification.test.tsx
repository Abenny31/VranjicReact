import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PortalClassification from './PortalClassification';
import { fetchAdminAreas, fetchAdminTags, updateArea } from '@/lib/classification-api';
import type { Area } from '@/lib/types';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test') }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('@/components/common/LazyTranslationEditor', () => ({ default: () => null }));
vi.mock('@/lib/classification-api', () => ({
    fetchAdminAreas: vi.fn(), fetchAdminTags: vi.fn(), updateArea: vi.fn(),
    createArea: vi.fn(), deleteArea: vi.fn(), createTag: vi.fn(), updateTag: vi.fn(), deleteTag: vi.fn(),
}));

const area: Area = { id: 2, name: 'Vatrogasci', slug: 'vatrogasci', sortOrder: 10, isActive: true, createdAt: '2026-01-01' };

async function editOrder() {
    render(<PortalClassification section="areas" />);
    const row = (await screen.findByText(area.name)).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Uredi' }));
    const input = screen.getByRole('spinbutton', { name: 'Redoslijed u navigaciji' });
    expect(input).toHaveValue(10);
    fireEvent.change(input, { target: { value: '-1' } });
    return input;
}

describe('Area navigation order editing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchAdminAreas).mockResolvedValue([area]);
        vi.mocked(fetchAdminTags).mockResolvedValue([]);
    });

    it('saves the chosen order and shows the persisted value and confirmation', async () => {
        vi.mocked(updateArea).mockResolvedValue({ ...area, sortOrder: -1 });
        const input = await editOrder();
        expect(screen.queryByRole('heading', { name: 'Oznake' })).not.toBeInTheDocument();
        expect(fetchAdminTags).not.toHaveBeenCalled();
        expect(input).toHaveAccessibleDescription(/Manji broj/);
        vi.mocked(fetchAdminAreas).mockResolvedValue([{ ...area, sortOrder: -1 }]);
        fireEvent.click(within(input.closest('form')!).getByRole('button', { name: 'Spremi' }));
        await waitFor(() => expect(updateArea).toHaveBeenCalledWith(area.id,
            expect.objectContaining({ name: area.name, slug: area.slug, sortOrder: -1, isActive: true }), 'Bearer test'));
        expect(await screen.findByRole('status')).toHaveTextContent('Područje je spremljeno.');
        expect(within(screen.getByText(area.name).closest('tr')!).getByText('-1')).toBeInTheDocument();
    });

    it('shows only tags and loads only tags on the tags page', async () => {
        render(<PortalClassification section="tags" />);
        expect(await screen.findByRole('heading', { name: 'Nova oznaka' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Područja' })).not.toBeInTheDocument();
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        expect(fetchAdminAreas).not.toHaveBeenCalled();
        expect(fetchAdminTags).toHaveBeenCalledWith('Bearer test');
    });

    it('keeps the entered order when saving fails and does not show success', async () => {
        vi.mocked(updateArea).mockRejectedValue(new Error('Područje nije spremljeno.'));
        const input = await editOrder();
        fireEvent.click(within(input.closest('form')!).getByRole('button', { name: 'Spremi' }));
        expect(await screen.findByText('Područje nije spremljeno.')).toBeInTheDocument();
        expect(input).toHaveValue(-1);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(fetchAdminAreas).toHaveBeenCalledTimes(1);
    });
});
