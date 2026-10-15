import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUsersPage } from './account-api';
import { fetchContactMessagesPage } from './contact-api';

describe('Administrative query serialization', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('encodes search literally and transmits paging, false filters, Bearer and abort signal', async () => {
        const request = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]', {
            headers: { 'Content-Type': 'application/json', 'X-Has-More': 'false' },
        })));
        vi.stubGlobal('fetch', request);
        const signal = new AbortController().signal;
        await fetchUsersPage({ page: 2, search: ' name+tag&x@example.test ', role: 'Moderator', emailConfirmed: false, authorization: 'Bearer test', signal });
        const userQuery = new URL(request.mock.calls[0][0], 'https://example.test').searchParams;
        expect(Object.fromEntries(userQuery)).toEqual({ page: '2', limit: '20', search: 'name+tag&x@example.test', role: 'Moderator', emailConfirmed: 'false' });
        expect(request.mock.calls[0][1].signal).toBe(signal);
        expect(request.mock.calls[0][1].credentials).toBe('omit');
        expect((request.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer test');
        await fetchContactMessagesPage({ page: 3, search: '%literal_', archived: false, processed: false, authorization: 'Bearer test' });
        const contactQuery = new URL(request.mock.calls[1][0], 'https://example.test').searchParams;
        expect(Object.fromEntries(contactQuery)).toEqual({ page: '3', limit: '20', search: '%literal_', archived: 'false', processed: 'false' });
    });
});
