import type { Tag } from './types';

export function resolveContributionTags(tags: Tag[], slugs: string[], selectedTagId?: number) {
    const wanted = new Set(slugs.map(slug => slug.toLowerCase()));
    return tags.filter(tag => tag.isActive && (wanted.has(tag.slug.toLowerCase()) || tag.id === selectedTagId)).map(tag => tag.id);
}

export type ContributionKind = 'prica' | 'obavijest' | 'vremenska-obavijest' | 'galerija';
export function contributionPath(kind: ContributionKind, options: { area?: string; tagId?: string; perspective?: string; from?: string } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value) query.set(key, value);
    return `/dodaj/${kind}${query.size ? `?${query}` : ''}`;
}
