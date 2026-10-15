import type { ContentOrigin, ContentSourceType, ContentTimePerspective, EditorialStatus } from './types';

export const perspectiveLabels: Record<ContentTimePerspective, string> = {
    Jucer: 'Jučer',
    Danas: 'Danas',
    Sutra: 'Sutra',
};

export const originLabels: Record<ContentOrigin, string> = {
    DocumentedAndVerified: 'Dokumentirano i provjereno',
    PersonalTestimony: 'Osobno svjedočanstvo',
    OralTradition: 'Usmena predaja',
    AuthorCommentary: 'Autorski osvrt',
};

export const sourceTypeLabels: Record<ContentSourceType, string> = {
    Book: 'Knjiga',
    Document: 'Dokument',
    Archive: 'Arhiva',
    Url: 'Mrežni izvor',
};

export const editorialStatusLabels: Record<EditorialStatus, string> = {
    Draft: 'Nacrt',
    PendingReview: 'Čeka pregled',
    ChangesRequested: 'Potrebne izmjene',
    Rejected: 'Odbijeno',
    Approved: 'Odobreno',
    Published: 'Objavljeno',
    Archived: 'Arhivirano',
};
