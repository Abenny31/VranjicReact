import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PublicContactProvider } from '@/contexts/PublicContactContext';
import { fetchPublicContact, type PublicContact } from '@/lib/public-contact-api';
import Footer2 from '@/components/widgets/Footer2';
import SupportContact from '@/components/common/SupportContact';
import Kontakt from './Kontakt';

vi.mock('@/lib/public-contact-api', async importOriginal => ({
    ...await importOriginal<typeof import('@/lib/public-contact-api')>(), fetchPublicContact: vi.fn(),
}));

const contact: PublicContact = {
    address: 'Configured address', email: 'public@example.test', supportEmail: 'support@example.test',
    phone: '+385 (98) 123-4567', facebookUrl: 'https://www.facebook.com/configured-page',
};

describe('Configured public contacts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        vi.mocked(fetchPublicContact).mockResolvedValue(contact);
    });

    it('uses configured public links and a Facebook icon without public administrator or roles links', async () => {
        render(<LanguageProvider><PublicContactProvider><Kontakt /><Footer2 /></PublicContactProvider></LanguageProvider>);
        const footer = screen.getByRole('contentinfo');
        expect(await within(footer).findByRole('link', { name: contact.email })).toHaveAttribute('href', 'mailto:public@example.test');
        expect(within(footer).getByRole('link', { name: contact.phone })).toHaveAttribute('href', 'tel:+385981234567');
        expect(screen.getAllByRole('link', { name: contact.email })).toHaveLength(2);
        expect(screen.queryByRole('link', { name: /administrator|Uloge/ })).not.toBeInTheDocument();
        expect(screen.queryByText(contact.supportEmail)).not.toBeInTheDocument();
        const footerFacebook = within(footer).getByRole('link', { name: 'Facebook' });
        expect(footerFacebook.querySelector('svg')).toBeInTheDocument();
        expect(footerFacebook.textContent).toBe('');
        for (const facebook of screen.getAllByRole('link', { name: 'Facebook' })) {
            expect(facebook).toHaveAttribute('href', contact.facebookUrl);
            expect(facebook).toHaveAttribute('target', '_blank');
            expect(facebook).toHaveAttribute('rel', 'noopener noreferrer');
        }
        expect(fetchPublicContact).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('AB31 — autor web-stranice').tagName).toBe('SPAN');
    });

    it('omits unconfigured details without inventing addresses or showing empty links', async () => {
        vi.mocked(fetchPublicContact).mockResolvedValue({ address: '', email: '', supportEmail: '', phone: '', facebookUrl: '' });
        render(<LanguageProvider><PublicContactProvider><Footer2 /><SupportContact /></PublicContactProvider></LanguageProvider>);
        await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByText(/000 000 000|uskoro/)).not.toBeInTheDocument();
    });

    it('reports loading and a failed request, then supports retry', async () => {
        vi.mocked(fetchPublicContact).mockRejectedValueOnce(new Error('Unavailable'));
        render(<LanguageProvider><PublicContactProvider><SupportContact /></PublicContactProvider></LanguageProvider>);
        expect(screen.getByRole('status')).toHaveTextContent('Učitavanje kontaktnih podataka');
        expect(await screen.findByText('Kontaktni podaci trenutačno nisu dostupni.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Pokušaj ponovno' }));
        expect(await screen.findByRole('link', { name: 'Kontaktirajte administratora' })).toHaveAttribute('href', 'mailto:support@example.test');
        expect(fetchPublicContact).toHaveBeenCalledTimes(2);
    });

    it('keeps configuration values unchanged when switching interface language', async () => {
        window.localStorage.setItem('vranjicreact.language', 'en');
        render(<LanguageProvider><PublicContactProvider><Footer2 /><SupportContact /></PublicContactProvider></LanguageProvider>);
        expect(await screen.findByText('Address')).toBeInTheDocument();
        expect(screen.getByText(contact.address)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Contact the administrator' })).toHaveAttribute('href', 'mailto:support@example.test');
        expect(screen.queryByText(contact.supportEmail)).not.toBeInTheDocument();
    });
});
