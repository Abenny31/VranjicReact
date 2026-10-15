import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api-client';
import { AREAS_CHANGED_EVENT, createArea, updateArea, deleteArea } from './classification-api';
vi.mock('./api-client', () => ({ apiFetch: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const payload = { name: 'Vatrogasci', sortOrder: 0, isActive: true };
describe('Area change notifications', () => {
    it('notifies navigation after successful create, update and delete', async () => {
        const dispatch = vi.spyOn(window, 'dispatchEvent');
        vi.mocked(apiFetch).mockResolvedValue({ ...payload, id: 1 });
        await createArea(payload, 'Bearer test');
        await updateArea(1, payload, 'Bearer test');
        await deleteArea(1, 'Bearer test');
        expect(dispatch.mock.calls.map(([event]) => event.type)).toEqual(Array(3).fill(AREAS_CHANGED_EVENT));
    });
    it('does not announce a failed mutation', async () => {
        const dispatch = vi.spyOn(window, 'dispatchEvent');
        vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Save failed'));
        await expect(createArea(payload, 'Bearer test')).rejects.toThrow('Save failed');
        expect(dispatch).not.toHaveBeenCalled();
    });
});
