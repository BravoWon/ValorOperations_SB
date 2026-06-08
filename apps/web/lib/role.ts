// apps/web/lib/role.ts
import type { Role } from '@valor/core';

export type { Role };

/** All roles (also the switcher display order); privilege comes from ROLE_RANK, not array index. */
export const ALL_ROLES: Role[] = ['owner', 'admin', 'ops', 'field', 'vendor', 'viewer'];

/** Higher rank = more access. */
export const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  ops: 3,
  field: 2,
  vendor: 1,
  viewer: 0,
};

export const DEFAULT_ROLE: Role = 'owner';
export const ROLE_COOKIE = 'valor_demo_role';

/** Type guard: is an arbitrary string one of the known roles? */
export function isRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value);
}

/** True when `current` is at least as privileged as `min`. */
export function roleSatisfies(current: Role, min: Role): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[min];
}

/** Read the demo role from a `document.cookie`-style string; default owner. */
export function parseRoleCookie(cookieString: string): Role {
  const hit = cookieString
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ROLE_COOKIE}=`));
  const value = hit ? hit.slice(ROLE_COOKIE.length + 1) : '';
  return isRole(value) ? value : DEFAULT_ROLE;
}
