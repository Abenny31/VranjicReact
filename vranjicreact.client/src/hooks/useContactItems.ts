import { IconBrandFacebook, IconMail, IconMapPin, IconPhone } from '@tabler/icons-react';
import { usePublicContact } from '@/contexts/PublicContactContext';
import { useUiTranslation } from './useUiTranslation';
import { emailHref, phoneHref } from '@/lib/public-contact-api';
import type { Item } from '@/shared/types';

export function useContactItems(): Item[] {
    const { contact } = usePublicContact();
    const { ui } = useUiTranslation();
    if (!contact) return [];
    return [
        { title: ui('Adresa'), description: contact.address, icon: IconMapPin },
        { title: ui('Telefon'), description: contact.phone, href: phoneHref(contact.phone), icon: IconPhone },
        { title: ui('Email'), description: contact.email, href: emailHref(contact.email), icon: IconMail },
        { title: ui('Društvene mreže'), description: contact.facebookUrl ? 'Facebook' : '', href: contact.facebookUrl, icon: IconBrandFacebook },
    ].filter(item => item.description);
}
