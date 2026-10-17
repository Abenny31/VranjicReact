import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { translateText } from '@/lib/translation-api';
import type { ContentTranslation, TranslationEdit } from '@/lib/content-translations';
import TranslationEditor from './TranslationEditor';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ getAccessToken: async () => 'Bearer test' }) }));
vi.mock('@/lib/translation-api', () => ({ translateText: vi.fn() }));

const saved: ContentTranslation[] = [{ language: 'en', fields: { title: 'Manual title', body: 'Manual body' }, isStale: false, version: 'version-one' }];
const save = vi.fn();

function Harness({ original = [], initialTitle = 'Hrvatski naslov', initialBody = '' }: { original?: ContentTranslation[]; initialTitle?: string; initialBody?: string }) {
    const [title, setTitle] = useState(initialTitle);
    const [edits, setEdits] = useState<TranslationEdit[]>([]);
    const [busy, setBusy] = useState(false);
    return <LanguageProvider>
        <label>HR naslov<input value={title} onChange={event => setTitle(event.target.value)} /></label>
        <TranslationEditor source={{ title, body: initialBody }} saved={original} edits={edits} onChange={setEdits} onBusyChange={setBusy} />
        <button disabled={busy} onClick={() => save({ title, translations: edits })}>Spremi obrazac</button>
        <output data-testid="edits">{JSON.stringify(edits)}</output>
    </LanguageProvider>;
}

beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('TranslationEditor', () => {
    it('translates nonempty HR fields, allows manual corrections and saves only on explicit Save', async () => {
        vi.mocked(translateText).mockResolvedValue({ text: 'English title' });
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: 'Prevedi na engleski' }));
        await waitFor(() => expect(screen.getByLabelText('Naslov (EN)')).toHaveValue('English title'));
        expect(translateText).toHaveBeenCalledTimes(1);
        expect(translateText).toHaveBeenCalledWith('Hrvatski naslov', 'en', 'Bearer test', expect.any(AbortSignal));
        expect(save).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Naslov (EN)'), { target: { value: 'Reviewed title' } });
        fireEvent.click(screen.getByText('Spremi obrazac'));
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hrvatski naslov', translations: [expect.objectContaining({ language: 'en', fields: { title: 'Reviewed title', body: '' } })] }));
    });

    it('does not replace existing manual translations without confirmation', () => {
        vi.mocked(window.confirm).mockReturnValue(false);
        render(<Harness original={saved} />);
        fireEvent.click(screen.getByText('Prevedi na engleski'));
        expect(translateText).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Naslov (EN)')).toHaveValue('Manual title');
    });

    it('preserves all existing fields when a later field fails to translate', async () => {
        vi.mocked(translateText).mockResolvedValueOnce({ text: 'New title' }).mockRejectedValueOnce(new Error('Quota reached'));
        render(<Harness original={saved} initialBody="Hrvatski sadržaj" />);
        fireEvent.click(screen.getByText('Prevedi na engleski'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Quota reached');
        expect(screen.getByLabelText('Naslov (EN)')).toHaveValue('Manual title');
        expect(screen.getByLabelText('Sadržaj (EN)')).toHaveValue('Manual body');
        expect(screen.getByTestId('edits')).toHaveTextContent('[]');
        expect(screen.getByText('Spremi obrazac')).toBeEnabled();
    });

    it('rejects stale asynchronous results if HR changes while translating', async () => {
        let resolve: (value: { text: string }) => void = () => { throw new Error('No request'); };
        vi.mocked(translateText).mockImplementation(() => new Promise(done => { resolve = done; }));
        render(<Harness />);
        fireEvent.click(screen.getByText('Prevedi na engleski'));
        await waitFor(() => expect(translateText).toHaveBeenCalled());
        expect(screen.getByText('Spremi obrazac')).toBeDisabled();
        fireEvent.change(screen.getByLabelText('HR naslov'), { target: { value: 'Promijenjen naslov' } });
        await act(async () => resolve({ text: 'Outdated translation' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Hrvatski tekst promijenjen');
        expect(screen.getByLabelText('Naslov (EN)')).toHaveValue('');
    });

    it('aborts an in-flight request on unmount', async () => {
        vi.mocked(translateText).mockImplementation(() => new Promise(() => {}));
        const view = render(<Harness />);
        fireEvent.click(screen.getByText('Prevedi na engleski'));
        await waitFor(() => expect(translateText).toHaveBeenCalled());
        const signal = vi.mocked(translateText).mock.calls[0][3];
        view.unmount();
        expect(signal.aborted).toBe(true);
    });

    it('queues only the selected language for deletion and keeps HR', () => {
        render(<Harness original={saved} />);
        fireEvent.click(screen.getByText('Obriši prijevod'));
        expect(screen.getByText('Ovaj prijevod bit će obrisan nakon spremanja.')).toBeInTheDocument();
        expect(screen.getByLabelText('HR naslov')).toHaveValue('Hrvatski naslov');
        fireEvent.click(screen.getByText('Spremi obrazac'));
        expect(save).toHaveBeenCalledWith({ title: 'Hrvatski naslov', translations: [{ language: 'en', version: 'version-one', delete: true }] });
    });

    it('shows English without exposing arbitrary language controls', () => {
        render(<Harness />);
        expect(screen.getByLabelText('Jezik prijevoda')).toHaveValue('en');
        expect(screen.queryByLabelText('Oznaka novog jezika')).not.toBeInTheDocument();
        expect(screen.queryByText('Dodaj jezik')).not.toBeInTheDocument();
    });

    it('does not send empty or oversized fields', () => {
        const view = render(<Harness initialTitle=" " />);
        expect(screen.getByText('Prevedi na engleski')).toBeDisabled();
        view.unmount();
        render(<Harness initialTitle={'a'.repeat(10001)} />);
        fireEvent.click(screen.getByText('Prevedi na engleski'));
        expect(screen.getByRole('alert')).toHaveTextContent('10.000');
        expect(translateText).not.toHaveBeenCalled();
    });
});
