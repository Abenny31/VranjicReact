import { apiFetch } from './api-client';

export interface PublicContact {
    address: string;
    email: string;
    supportEmail: string;
    phone: string;
    facebookUrl: string;
}

export const fetchPublicContact = (signal?: AbortSignal) =>
    apiFetch<PublicContact>('/api/public-contact', { signal });

export const emailHref = (email: string) => `mailto:${encodeURIComponent(email).replace('%40', '@')}`;
export const phoneHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`;
