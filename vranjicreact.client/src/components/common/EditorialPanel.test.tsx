import { LanguageProvider } from '@/contexts/LanguageContext';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditorialPanel from './EditorialPanel';
import { fetchModerationHistory, submitForReview } from '@/lib/moderation-api';
const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test'), hasRole: vi.fn().mockReturnValue(false) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/moderation-api', () => ({
    submitForReview: vi.fn().mockResolvedValue(undefined), publishApproved: vi.fn(), archiveContent: vi.fn(), fetchModerationHistory: vi.fn(),
}));
describe('EditorialPanel', () => {
    beforeEach(() => { vi.clearAllMocks(); auth.hasRole.mockReturnValue(false); });
    const show = (canSubmit = true) => {
        const onChanged = vi.fn();
        render(<LanguageProvider><EditorialPanel type="Announcement" id={7} status="Draft" rowVersion="AQ==" canSubmit={canSubmit} onChanged={onChanged} /></LanguageProvider>);
        return onChanged;
    };
    it('does not give contributors publish or archive actions', () => {
        show(false);
        expect(screen.queryByRole('button', { name: /Objavi/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Arhiviraj' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pošalji na pregled' })).not.toBeInTheDocument();
    });
    it('submits the version and refreshes after success', async () => {
        const changed = show();
        fireEvent.click(screen.getByRole('button', { name: 'Pošalji na pregled' }));
        await waitFor(() => expect(submitForReview).toHaveBeenCalledWith('Announcement', 7, 'AQ==', 'Bearer test'));
        expect(changed).toHaveBeenCalledOnce();
    });
    it('loads full history with older pages and comments', async () => {
        vi.mocked(fetchModerationHistory).mockResolvedValueOnce({ items: [{ id: 10, action: 'Approved', previousStatus: 'PendingReview', newStatus: 'Approved', createdAt: '2026-01-01', comment: 'Sve provjereno' }], nextBeforeId: 10 })
            .mockResolvedValueOnce({ items: [{ id: 9, action: 'Submitted', previousStatus: 'Draft', newStatus: 'PendingReview', createdAt: '2025-12-31' }], nextBeforeId: null });
        show();
        fireEvent.click(screen.getByRole('button', { name: 'Povijest moderiranja' }));
        expect(await screen.findByText('Sve provjereno')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Starije odluke' }));
        await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
        expect(fetchModerationHistory).toHaveBeenLastCalledWith('Announcement', 7, 'Bearer test', 10);
    });
    it('shows server errors without reporting success', async () => {
        vi.mocked(submitForReview).mockRejectedValueOnce(new Error('Sadržaj je promijenjen.'));
        const changed = show();
        fireEvent.click(screen.getByRole('button', { name: 'Pošalji na pregled' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Sadržaj je promijenjen.');
        expect(changed).not.toHaveBeenCalled();
    });
});
