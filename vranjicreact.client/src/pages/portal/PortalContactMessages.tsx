import { useUiTranslation } from '@/hooks/useUiTranslation';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    fetchContactMessagesPage,
    type ContactListOptions,
    markContactProcessed,
    setContactArchive,
} from '@/lib/contact-api';
import { useEditorialList } from '@/hooks/useEditorialList';
import ListPagination from '@/components/common/ListPagination';

type Filter = 'all' | 'pending' | 'archived';

export default function PortalContactMessages() {
    const { ui } = useUiTranslation();
    const { getAccessToken } = useAuth();
    const { t, language } = useLanguage();
    const [filter, setFilter] = useState<Filter>('all');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const loadPage = useCallback((options: ContactListOptions) => fetchContactMessagesPage({ ...options, search,
        archived: filter === 'archived' ? true : filter === 'pending' ? false : undefined,
        processed: filter === 'pending' ? false : undefined }), [search, filter]);
    const { items: messages, loading, error, page, setPage, hasMore, refresh, refreshAfterDelete } = useEditorialList(loadPage);
    const [actionError, setActionError] = useState<string | null>(null);

    const locale = language === 'en' ? 'en-US' : 'hr-HR';

    const handleProcess = async (id: number) => {
        setActionError(null);
        setSaving(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                setActionError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await markContactProcessed(id, token);
            if (filter === 'pending') refreshAfterDelete();
            else refresh();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Dogodila se greška.';
            setActionError(message);
        } finally { setSaving(false); }
    };

    const handleArchive = async (id: number, archived: boolean) => {
        setActionError(null);
        setSaving(true);
        try {
            const token = await getAccessToken();
            if (!token) {
                setActionError('Sesija je istekla. Prijavite se ponovno.');
                return;
            }

            await setContactArchive(id, archived, token);
            if (filter !== 'all') refreshAfterDelete();
            else refresh();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Dogodila se greška.';
            setActionError(message);
        } finally { setSaving(false); }
    };

    const filters = useMemo(
        () => [
            { value: 'all' as const, label: t('portal.contact.filter.all', 'Sve') },
            { value: 'pending' as const, label: t('portal.contact.filter.unprocessed', 'Neobrađene') },
            { value: 'archived' as const, label: t('portal.contact.filter.archived', 'Arhivirane') },
        ],
        [t]
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-800">
                    {t('portal.contact.title', 'Poruke s kontakt forme')}
                </h2>
                <div className="flex flex-wrap gap-2">
                    {filters.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            disabled={saving}
                            aria-pressed={filter === option.value}
                            onClick={() => { setFilter(option.value); setPage(1); }}
                            className={`rounded px-3 py-1.5 text-sm font-semibold transition ${
                                filter === option.value
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <form onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }} className="flex flex-wrap items-end gap-3">
                <label className="text-sm">{ui("Pretraga poruka")} <input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={200} disabled={saving} className="ml-2 rounded border p-2" placeholder={ui("Ime, email ili tekst poruke")} />
                </label>
                <button disabled={saving} className="rounded border px-3 py-2 text-sm">{ui("Pretraži")}</button>
            </form>
            {error && <div role="alert" className="text-sm text-red-600">{ui(error)} <button type="button" onClick={refresh}>{ui("Pokušaj ponovno")}</button></div>}
            {actionError && <p className="text-sm text-red-600">{ui(actionError)}</p>}

            {loading && <p role="status" className="text-sm text-slate-500">{t('common.loading', 'Učitavanje...')}</p>}
            {!loading && !error && (messages.length === 0 ? (
                <p className="text-sm text-slate-600">{t('portal.contact.empty', 'Nema poruka.')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('portal.contact.name', 'Ime')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('portal.contact.email', 'Email')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('portal.contact.message', 'Poruka')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('portal.contact.submittedAt', 'Poslano')}
                                </th>
                                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                                    {t('portal.contact.status', 'Status')}
                                </th>
                                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                                    {t('portal.contact.actions', 'Radnje')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {messages.map(message => {
                                const submitted = new Date(message.submittedAt).toLocaleString(locale);
                                const status = message.archived
                                    ? t('portal.contact.status.archived', 'Arhivirano')
                                    : message.processedAt
                                      ? t('portal.contact.status.processed', 'Obrađeno')
                                      : t('portal.contact.status.pending', 'Na čekanju');

                                return (
                                    <tr key={message.id}>
                                        <td className="px-4 py-2 font-medium text-slate-800">{message.name}</td>
                                        <td className="px-4 py-2 text-slate-600">{message.email}</td>
                                        <td className="px-4 py-2 text-slate-600">
                                            <span className="line-clamp-3 whitespace-pre-line">{message.message}</span>
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">{submitted}</td>
                                        <td className="px-4 py-2 text-slate-600">{status}</td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex justify-end gap-2">
                                                {!message.processedAt && !message.archived && (
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() => void handleProcess(message.id)}
                                                        className="rounded border border-green-200 px-3 py-1 text-xs font-semibold text-green-700 transition hover:border-green-300 hover:text-green-800"
                                                    >
                                                        {t('portal.contact.process', 'Obradi')}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={() => void handleArchive(message.id, !message.archived)}
                                                    className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                                                >
                                                    {message.archived
                                                        ? t('portal.contact.unarchive', 'Vrati')
                                                        : t('portal.contact.archive', 'Arhiviraj')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}
            <ListPagination page={page} hasMore={hasMore} onPageChange={setPage} disabled={loading || saving || !!error} />
        </div>
    );
}
