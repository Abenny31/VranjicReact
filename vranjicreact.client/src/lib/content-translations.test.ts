import { describe, expect, it } from 'vitest';
import { localizeContent } from './content-translations';

describe('stored content localization', () => {
    it('localizes nested content without modifying HR, URLs, slugs or empty untranslated fields', () => {
        const original = { title: 'Naslov', body: 'Sadržaj', slug: 'naslov', area: {
            name: 'Područje', translations: [{ language: 'en', isStale: false, fields: { name: 'Area' }, version: '1' }],
        }, translations: [{ language: 'en', isStale: false, fields: { title: 'Title', body: '', unknown: 'Ignored' }, version: '1' }] };
        const result = localizeContent({ items: [original] }, 'en');
        expect(result.items[0]).toMatchObject({ title: 'Title', body: 'Sadržaj', slug: 'naslov', area: { name: 'Area' } });
        expect(result.items[0]).not.toHaveProperty('unknown');
        expect(original.title).toBe('Naslov');
        expect(original.area.name).toBe('Područje');
        expect(localizeContent(original, 'hr')).toBe(original);
    });

    it('falls back to HR for missing or stale translations', () => {
        const original = { title: 'Naslov', translations: [{ language: 'en', isStale: true, fields: { title: 'Outdated' }, version: '1' }] };
        expect(localizeContent(original, 'en').title).toBe('Naslov');
        expect(localizeContent(original, 'de').title).toBe('Naslov');
        expect(localizeContent(null, 'en')).toBeNull();
    });
});
