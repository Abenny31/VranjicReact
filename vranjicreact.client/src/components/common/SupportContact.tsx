import { usePublicContact } from '@/contexts/PublicContactContext';
import { useUiTranslation } from '@/hooks/useUiTranslation';
import { emailHref } from '@/lib/public-contact-api';

export default function SupportContact() {
    const { contact, loading, error, reload } = usePublicContact();
    const { ui } = useUiTranslation();
    if (loading) return <p role="status" className="text-sm text-slate-500">{ui('Učitavanje kontaktnih podataka...')}</p>;
    if (error) return <p role="status" className="text-sm text-slate-500">
        {ui('Kontaktni podaci trenutačno nisu dostupni.')} {' '}
        <button type="button" className="underline" onClick={reload}>{ui('Pokušaj ponovno')}</button>
    </p>;
    if (!contact?.supportEmail) return null;
    return <p className="text-xs text-slate-500 dark:text-slate-400">
        <a href={emailHref(contact.supportEmail)} className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">{ui('Kontaktirajte administratora')}</a>
    </p>;
}
