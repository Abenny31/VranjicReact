import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorialList } from './useEditorialList';
import type { ListPage } from '@/lib/api-client';

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn().mockResolvedValue('Bearer test') }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

describe('useEditorialList', () => {
    beforeEach(() => { auth.getAccessToken.mockResolvedValue('Bearer test'); });
    it('loads authorized pages and returns to the previous page after deleting its last row', async () => {
        const load = vi.fn().mockResolvedValue({ items: [{ id: 1 }], hasMore: true });
        const { result } = renderHook(() => useEditorialList(load));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ authorization: 'Bearer test', page: 1, includeUnpublished: true }));
        act(() => result.current.setPage(2));
        await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => result.current.refreshAfterDelete());
        await waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
    });
    it('cancels stale requests and clears an error on retry', async () => {
        let resolveOld!: (value: ListPage<{ id: number }>) => void;
        const load = vi.fn().mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }))
            .mockRejectedValueOnce(new Error('Greška'))
            .mockResolvedValue({ items: [], hasMore: false });
        const { result } = renderHook(() => useEditorialList(load));
        await waitFor(() => expect(load).toHaveBeenCalledOnce());
        const signal = load.mock.calls[0][0].signal as AbortSignal;
        act(() => result.current.setPage(2));
        await waitFor(() => expect(result.current.error).toBe('Greška'));
        expect(signal.aborted).toBe(true);
        await act(async () => { resolveOld({ items: [{ id: 99 }], hasMore: true }); });
        expect(result.current.items).toEqual([]);
        act(() => result.current.refresh());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeNull();
        expect(result.current.hasMore).toBe(false);
    });
    it('does not call a private endpoint without an access token', async () => {
        auth.getAccessToken.mockResolvedValue(null);
        const load = vi.fn();
        const { result } = renderHook(() => useEditorialList(load));
        await waitFor(() => expect(result.current.error).toContain('Sesija je istekla'));
        expect(load).not.toHaveBeenCalled();
    });
});
