import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createTag } from '@/lib/classification-api';
import type { Tag } from '@/lib/types';
import TagPicker from './TagPicker';

const auth = vi.hoisted(() => ({ hasRole: vi.fn(), getAccessToken: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/classification-api', () => ({ createTag: vi.fn() }));
const initial: Tag[] = [
    { id: 1, name: 'Mačkare', slug: 'mackare', isActive: true },
    { id: 2, name: 'Sport', slug: 'sport', isActive: true },
];

function Form() {
    const [tags, setTags] = useState(initial);
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    return <><TagPicker tags={tags} selectedIds={selected} onChange={setSelected}
        onCreated={tag => setTags(current => [...current, tag])} onBusyChange={setBusy} />
        <button disabled={busy}>Spremi objavu</button></>;
}
const show = () => render(<LanguageProvider><Form /></LanguageProvider>);

describe('TagPicker', () => {
    beforeEach(() => {
        vi.mocked(createTag).mockReset();
        auth.hasRole.mockImplementation((role: string) => role === 'Administrator');
        auth.getAccessToken.mockResolvedValue('Bearer test');
    });
    it('allows multiple tags without Ctrl, and regular users cannot create tags', () => {
        auth.hasRole.mockReturnValue(false);
        show();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Mačkare' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Sport' }));
        expect(screen.getByRole('checkbox', { name: 'Mačkare' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Sport' })).toBeChecked();
        expect(screen.queryByText('Dodaj oznaku')).not.toBeInTheDocument();
        expect(createTag).not.toHaveBeenCalled();
    });
    it('creates a suggested tag only on confirmation, selects its real ID and blocks post save while pending', async () => {
        let finish!: (tag: Tag) => void;
        vi.mocked(createTag).mockReturnValue(new Promise(resolve => { finish = resolve; }));
        show();
        fireEvent.click(screen.getByText('Dodaj oznaku'));
        fireEvent.click(screen.getByRole('button', { name: 'Događaji' }));
        expect(createTag).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Dodaj i odaberi' }));
        await waitFor(() => expect(createTag).toHaveBeenCalledWith({ name: 'Događaji', isActive: true }, 'Bearer test'));
        expect(screen.getByRole('button', { name: 'Spremi objavu' })).toBeDisabled();
        await act(async () => finish({ id: 8, name: 'Događaji', slug: 'dogadaji', isActive: true }));
        expect(screen.getByRole('checkbox', { name: 'Događaji' })).toBeChecked();
        expect(screen.getByRole('button', { name: 'Spremi objavu' })).toBeEnabled();
    });
    it('keeps selection and input after a failed creation', async () => {
        vi.mocked(createTag).mockRejectedValue(new Error('Oznaka nije spremljena.'));
        show();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Sport' }));
        fireEvent.click(screen.getByText('Dodaj oznaku'));
        fireEvent.change(screen.getByLabelText('Naziv nove oznake'), { target: { value: 'Kultura' } });
        fireEvent.click(screen.getByRole('button', { name: 'Dodaj i odaberi' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Oznaka nije spremljena.');
        expect(screen.getByRole('checkbox', { name: 'Sport' })).toBeChecked();
        expect(screen.getByLabelText('Naziv nove oznake')).toHaveValue('Kultura');
        expect(screen.getByRole('button', { name: 'Spremi objavu' })).toBeEnabled();
    });
    it('selects an existing tag without posting a duplicate', () => {
        show();
        fireEvent.click(screen.getByText('Dodaj oznaku'));
        fireEvent.change(screen.getByLabelText('Naziv nove oznake'), { target: { value: ' sport ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Dodaj i odaberi' }));
        expect(screen.getByRole('checkbox', { name: 'Sport' })).toBeChecked();
        expect(createTag).not.toHaveBeenCalled();
    });
});
