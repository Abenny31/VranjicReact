import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { submitContact } from '@/lib/contact-api';
import Kontakt from './Kontakt';

vi.mock('@/lib/contact-api');
vi.mock('@/contexts/PublicContactContext', () => ({ usePublicContact: () => ({ contact: null, loading: false, error: false }) }));
const show = () => render(<LanguageProvider><Kontakt /></LanguageProvider>);
function fill() {
    fireEvent.change(screen.getByRole('textbox', { name: 'Ime' }), { target: { value: 'Test' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Prezime' }), { target: { value: 'Osoba' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email adresa' }), { target: { value: 'test@example.test' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Upišite svoju poruku' }), { target: { value: 'Testna poruka' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Donacije' }));
}
describe('Contact form submission', () => {
    beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });
    it('includes the selected reason and resets after the asynchronous response without a false error', async () => {
        let finish!: () => void;
        vi.mocked(submitContact).mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
        show(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Pošalji' }));
        expect(submitContact).toHaveBeenCalledWith({ name: 'Test Osoba', email: 'test@example.test', message: 'Razlog kontakta: Donacije\n\nTestna poruka' });
        expect(screen.getByRole('button', { name: 'Slanje...' })).toBeDisabled();
        await act(async () => finish());
        expect(screen.getByRole('status')).toHaveTextContent('Poruka je uspješno poslana.');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Ime' })).toHaveValue('');
        expect(screen.getByRole('radio', { name: 'Donacije' })).not.toBeChecked();
        expect(submitContact).toHaveBeenCalledTimes(1);
    });
    it('preserves entered values after a rejected request', async () => {
        vi.mocked(submitContact).mockRejectedValue(new Error('Slanje nije uspjelo.'));
        show(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Pošalji' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Slanje nije uspjelo.');
        expect(screen.getByRole('textbox', { name: 'Upišite svoju poruku' })).toHaveValue('Testna poruka');
        expect(screen.getByRole('radio', { name: 'Donacije' })).toBeChecked();
    });
    it('checks the existing server length limit including the reason prefix', async () => {
        show(); fill();
        fireEvent.change(screen.getByRole('textbox', { name: 'Upišite svoju poruku' }), { target: { value: 'x'.repeat(4096) } });
        fireEvent.click(screen.getByRole('button', { name: 'Pošalji' }));
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('4096'));
        expect(submitContact).not.toHaveBeenCalled();
    });
});
