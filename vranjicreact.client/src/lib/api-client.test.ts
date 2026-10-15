import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiFetchPage } from './api-client';

describe('API pagination compatibility', () => {
    afterEach(() => { vi.unstubAllGlobals(); });
    it('keeps legacy array responses and reads pagination headers separately', async () => {
        const request = vi.fn().mockImplementation(() => Promise.resolve(new Response('[{"id":1}]', {
            headers: { 'Content-Type': 'application/json', 'X-Has-More': 'true' },
        })));
        vi.stubGlobal('fetch', request);
        expect(await apiFetch('/api/gallery/albums')).toEqual([{ id: 1 }]);
        expect(await apiFetchPage('/api/gallery/albums?page=1&limit=20')).toEqual({ items: [{ id: 1 }], hasMore: true });
    });
    it('does not silently truncate when a stale backend or CORS hides the paging header', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
        await expect(apiFetchPage('/api/blog')).rejects.toThrow('API ne podržava straničenje');
    });
    it('uses Bearer authentication without cross-origin cookies', async () => {
        const request = vi.fn().mockResolvedValue(new Response('[]', { headers: { 'Content-Type': 'application/json', 'X-Has-More': 'false' } }));
        vi.stubGlobal('fetch', request);
        await apiFetchPage('/api/blog?page=1', { headers: { Authorization: 'Bearer test' } });
        expect(request.mock.calls[0][1].credentials).toBe('omit');
        expect((request.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer test');
    });
    it('propagates server errors instead of treating them as empty pages', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Nedovoljna prava.', { status: 403 })));
        await expect(apiFetchPage('/api/moderation/queue')).rejects.toThrow('Nedovoljna prava.');
    });
});
