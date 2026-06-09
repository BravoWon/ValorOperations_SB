// apps/web/__tests__/planes.test.ts
import { describe, it, expect } from 'vitest';
import { PLANES, planesForRole, minRoleForPath } from '@/lib/planes';
import { ALL_ROLES, ROLE_RANK } from '@/lib/role';

// The flat nav that existed before Slice A — every one must be placed exactly once.
const EXISTING_NAV = [
  '/dashboard', '/jobs', '/tickets', '/rig-day', '/assets',
  '/tools/hydraulics', '/tools/directional',
  '/data-manager', '/template-builder', '/bank-editor', '/office-ops', '/data-studio', '/local-db',
];

describe('planes registry', () => {
  it('places every existing nav route in exactly one plane, no extras', () => {
    const hrefs = PLANES.flatMap((p) => p.items.map((i) => i.href));
    for (const route of EXISTING_NAV) {
      expect(hrefs.filter((h) => h === route)).toHaveLength(1);
    }
    expect(hrefs.length).toBe(EXISTING_NAV.length);
  });

  it('every item has a valid min role', () => {
    for (const p of PLANES) {
      for (const i of p.items) {
        expect(ALL_ROLES).toContain(i.minRole);
        expect(typeof ROLE_RANK[i.minRole]).toBe('number');
      }
    }
  });

  it('planesForRole hides above-role items and drops empty planes', () => {
    const viewerHrefs = planesForRole('viewer').flatMap((p) => p.items.map((i) => i.href));
    expect(viewerHrefs).toContain('/dashboard');
    expect(viewerHrefs).not.toContain('/data-manager'); // admin-only
    expect(planesForRole('viewer').find((p) => p.id === 'administer')).toBeUndefined();
    expect(planesForRole('owner').flatMap((p) => p.items).length).toBe(EXISTING_NAV.length);
  });

  it('minRoleForPath matches items and defaults unknown routes to viewer', () => {
    expect(minRoleForPath('/data-manager')).toBe('admin');
    expect(minRoleForPath('/rig-day')).toBe('ops');
    expect(minRoleForPath('/wells/well-lf1')).toBe('viewer'); // not in registry → visible to all
  });
});
