import { useCallback, useMemo, useState } from 'react';
import Contact from '@/components/widgets/Contact';
import { useLanguage } from '@/contexts/LanguageContext';
import { submitContact } from '@/lib/contact-api';
import type { SubmitContactRequest } from '@/lib/types';
import { contact2Contact } from '@/shared/data/pages/contact.data';
import { useContactItems } from '@/hooks/useContactItems';

type Status = 'idle' | 'loading' | 'success' | 'error';

type FormValues = Record<string, FormDataEntryValue>;

const toStringValue = (value: FormDataEntryValue | undefined): string =>
    typeof value === 'string' ? value : '';

export default function Kontakt() {
    const { t } = useLanguage();
    const contactItems = useContactItems();
    const [status, setStatus] = useState<Status>('idle');
    const [feedback, setFeedback] = useState<string | null>(null);

    const handleSubmit = useCallback(
        async (values: FormValues, { reset }: { reset: () => void }) => {
            const firstName = toStringValue(values['name']);
            const lastName = toStringValue(values['lastName']);
            const email = toStringValue(values['email']).trim();
            const message = toStringValue(values['textarea']).trim();
            const reasonLabels: Record<string, string> = { general: 'Opći upit', events: 'Sudjelovanje u događajima', donations: 'Donacije' };
            const reason = reasonLabels[toStringValue(values['reason'])];
            const completeMessage = reason ? `Razlog kontakta: ${reason}\n\n${message}` : message;

            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!fullName || !email || !message) {
                setStatus('error');
                setFeedback('Molimo ispunite ime, prezime (ili naziv), email i poruku.');
                return;
            }

            if (!emailPattern.test(email)) {
                setStatus('error');
                setFeedback('Unesite ispravnu email adresu.');
                return;
            }

            if (fullName.length > 128 || email.length > 256 || completeMessage.length > 4096) {
                setStatus('error');
                setFeedback('Ime može imati najviše 128 znakova, email 256, a poruka s razlogom kontakta 4096 znakova.');
                return;
            }

            setStatus('loading');
            setFeedback(null);

            const payload: SubmitContactRequest = {
                name: fullName,
                email,
                message: completeMessage,
            };

            try {
                await submitContact(payload);
                setStatus('success');
                setFeedback('Poruka je uspješno poslana. Hvala!');
                reset();
            } catch (error) {
                setStatus('error');
                setFeedback(error instanceof Error ? error.message : 'Neuspjelo slanje poruke.');
            }
        },
        [],
    );

    const formProps = useMemo(
        () => ({
            ...contact2Contact.form,
            disabled: status === 'loading',
            onSubmit: handleSubmit,
        }),
        [handleSubmit, status],
    );

    const localizedContact = useMemo(
        () => {
            return {
            ...contact2Contact,
            header: {
                ...contact2Contact.header,
                title: t('contact.page.title', 'Kontaktiraj nas'),
                subtitle: t('contact.page.subtitle', 'Slobodno nam se javite.'),
            },
            items: contactItems,
            form: {
                ...formProps,
                title: t('contact.form.title', 'Javite se'),
                inputs: [
                    {
                        ...formProps.inputs[0],
                        label: t('contact.form.firstName', 'Ime'),
                        placeholder: t('contact.form.firstName', 'Ime'),
                    },
                    {
                        ...formProps.inputs[1],
                        label: t('contact.form.lastName', 'Prezime'),
                        placeholder: t('contact.form.lastName', 'Prezime'),
                    },
                    {
                        ...formProps.inputs[2],
                        label: t('contact.form.emailLabel', 'Email adresa'),
                        placeholder: t('contact.form.emailLabel', 'Email adresa'),
                    },
                ],
                radioBtns: formProps.radioBtns
                    ? {
                        ...formProps.radioBtns,
                        name: 'reason',
                        label: t('contact.form.reason', 'Razlog kontakta?'),
                        radios: [
                            { value: 'general', label: t('contact.form.reason.general', 'Opći upit') },
                            { value: 'events', label: t('contact.form.reason.events', 'Sudjelovanje u događajima') },
                            { value: 'donations', label: t('contact.form.reason.donations', 'Donacije') },
                        ],
                    }
                    : undefined,
                textarea: formProps.textarea
                    ? {
                        ...formProps.textarea,
                        label: t('contact.form.messageLabel', 'Upišite svoju poruku'),
                        placeholder: t('contact.form.messagePlaceholder', 'Poruka...'),
                    }
                    : undefined,
                btn: {
                    ...formProps.btn,
                    title: status === 'loading'
                        ? t('contact.form.submitting', 'Slanje...')
                        : t('contact.form.submit', 'Pošalji'),
                },
            },
        };
        },
        [contactItems, formProps, status, t],
    );

    return (
        <div className="space-y-6">
            <Contact {...localizedContact} form={localizedContact.form} />
            {feedback && (
                <div
                    role={status === 'success' ? 'status' : 'alert'}
                    className={`mx-auto max-w-3xl rounded-2xl border p-4 text-sm ${
                        status === 'success'
                            ? 'border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-100'
                            : 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-100'
                    }`}
                >
                    {t(feedback, feedback)}
                </div>
            )}
        </div>
    );
}
