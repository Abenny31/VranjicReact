import type { UserProfile } from './types';

export const PORTAL_ACCESS_ROLES = ['SuperUser', 'Administrator', 'Moderator', 'Korisnik', 'Provjeravatelj'] as const;
export const CONTENT_CREATE_ROLES = ['SuperUser', 'Administrator', 'Moderator', 'Korisnik'] as const;
export const CONTENT_MANAGE_ROLES = ['SuperUser', 'Administrator'] as const;
export const CONTENT_VERIFY_ROLES = ['SuperUser', 'Administrator', 'Provjeravatelj'] as const;
export const CONTENT_MODERATE_ROLES = ['SuperUser', 'Administrator', 'Moderator'] as const;
export const USER_MANAGE_ROLES = ['SuperUser', 'Administrator'] as const;
export const SUPERUSER_ONLY_ROLES = ['SuperUser'] as const;

type RoleName = (typeof PORTAL_ACCESS_ROLES)[number];

export function hasAnyRole(hasRole: (role: string) => boolean, roles: readonly RoleName[] | readonly string[]): boolean {
    return roles.some(role => hasRole(role));
}

export function userHasAnyRole(user: UserProfile | null, roles: readonly RoleName[] | readonly string[]): boolean {
    if (!user) {
        return false;
    }

    const userRoles = new Set(user.roles.map(role => role.toLowerCase()));
    return roles.some(role => userRoles.has(role.toLowerCase()));
}
