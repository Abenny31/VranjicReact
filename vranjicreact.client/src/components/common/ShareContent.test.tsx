import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import ShareContent from './ShareContent';

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
const originalCanShare = Object.getOwnPropertyDescriptor(navigator, 'canShare');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const show = () => render(<LanguageProvider><ShareContent title="Priča" text="Sažetak" path="/blog/73" /></LanguageProvider>);

describe('Sharing published content', () => {
    beforeEach(() => {
        window.localStorage.clear();
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    });
    afterEach(() => {
        if (originalShare) Object.defineProperty(navigator, 'share', originalShare); else Reflect.deleteProperty(navigator, 'share');
        if (originalCanShare) Object.defineProperty(navigator, 'canShare', originalCanShare); else Reflect.deleteProperty(navigator, 'canShare');
        if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard); else Reflect.deleteProperty(navigator, 'clipboard');
    });
    it('uses native sharing with a stable public ID URL', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'share', { configurable: true, value: share });
        show(); fireEvent.click(screen.getByRole('button', { name: 'Podijeli' }));
        await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Priča', text: 'Sažetak', url: `${window.location.origin}/blog/73` }));
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
    it('offers copy when native sharing is unavailable and keeps manual copying possible after denial', async () => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        const writeText = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        show(); fireEvent.click(screen.getByRole('button', { name: 'Podijeli' }));
        expect(screen.getByRole('textbox', { name: 'Poveznica za dijeljenje' })).toHaveValue(`${window.location.origin}/blog/73`);
        const sharedText = `Priča\n\nSažetak\n\n${window.location.origin}/blog/73`;
        expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(sharedText)}`);
        expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/blog/73`)}`);
        expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', `mailto:?subject=${encodeURIComponent('Priča')}&body=${encodeURIComponent(sharedText)}`);
        fireEvent.click(screen.getByRole('button', { name: 'Kopiraj poveznicu' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Označite i kopirajte');
        fireEvent.click(screen.getByRole('button', { name: 'Kopiraj poveznicu' }));
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Poveznica je kopirana.'));
    });
    it('treats native cancellation as cancellation rather than failure', async () => {
        const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
        Object.defineProperty(navigator, 'share', { configurable: true, value: share });
        show(); fireEvent.click(screen.getByRole('button', { name: 'Podijeli' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Podijeli' })).not.toBeDisabled());
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('offers all fallback options when native sharing fails', async () => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) });
        show(); fireEvent.click(screen.getByRole('button', { name: 'Podijeli' }));
        expect(await screen.findByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Facebook' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Email' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Kopiraj poveznicu' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Odaberite drugi način dijeljenja.');
    });

    it('uses fallback when canShare rejects the data and closes it with Escape', async () => {
        const share = vi.fn();
        Object.defineProperty(navigator, 'share', { configurable: true, value: share });
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn().mockReturnValue(false) });
        show();
        const button = screen.getByRole('button', { name: 'Podijeli' });
        fireEvent.click(button);
        const link = await screen.findByRole('link', { name: 'WhatsApp' });
        expect(share).not.toHaveBeenCalled();
        expect(button).toHaveAttribute('aria-expanded', 'true');
        link.focus();
        fireEvent.keyDown(link, { key: 'Escape' });
        expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
        expect(button).toHaveFocus();
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });
});
