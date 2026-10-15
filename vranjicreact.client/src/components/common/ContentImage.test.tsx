import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import ContentImage, { isProtectedMediaPath } from './ContentImage';

const getAccessToken = vi.hoisted(() => vi.fn().mockResolvedValue('Bearer test'));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ getAccessToken }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('sends authorization only to exact internal media routes', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/png' }) });
    vi.stubGlobal('fetch', fetch);
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = () => 'blob:photo'; static revokeObjectURL = revoke; });
    const view = render(<LanguageProvider><ContentImage src="/api/content-images/blog/1/7" alt="Slika" /></LanguageProvider>);
    expect(await screen.findByRole('img', { name: 'Slika' })).toHaveAttribute('src', 'blob:photo');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/content-images/blog/1/7'), expect.objectContaining({ headers: { Authorization: 'Bearer test' }, redirect: 'error' }));
    view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:photo');
    fetch.mockClear(); getAccessToken.mockClear();
    render(<LanguageProvider><ContentImage src="https://example.com/photo.jpg" alt="Vanjska" /></LanguageProvider>);
    expect(screen.getByRole('img', { name: 'Vanjska' })).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(fetch).not.toHaveBeenCalled(); expect(getAccessToken).not.toHaveBeenCalled();
    for (const src of ['//other.test/api/gallery/1/media', '/api/gallery/1/media?redirect=https://other.test', '/api/content-images/blog/1/7/../../users'])
        expect(isProtectedMediaPath(src)).toBe(false);
});

it('reports unavailable private media without showing the previous photo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<LanguageProvider><ContentImage src="/api/content-images/news/1/2" alt="Privatna" /></LanguageProvider>);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Fotografija nije dostupna.'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
