import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import PasswordField from './PasswordField';

describe('Password visibility', () => {
    it('toggles only its own input, preserves the value and never submits the form', () => {
        const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
        render(<LanguageProvider><form onSubmit={submit}>
            <PasswordField label="Lozinka" defaultValue="example9" autoComplete="current-password" />
            <PasswordField label="Potvrda" />
        </form></LanguageProvider>);
        const input = screen.getByLabelText('Lozinka');
        expect(input).toHaveAttribute('type', 'password');
        fireEvent.click(screen.getByRole('button', { name: 'Prikaži lozinku: Lozinka' }));
        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveValue('example9');
        expect(input).toHaveAttribute('autocomplete', 'current-password');
        expect(screen.getByLabelText('Potvrda')).toHaveAttribute('type', 'password');
        expect(screen.getByRole('button', { name: 'Sakrij lozinku: Lozinka' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Sakrij lozinku: Lozinka' }));
        expect(input).toHaveAttribute('type', 'password');
        expect(submit).not.toHaveBeenCalled();
    });
});
