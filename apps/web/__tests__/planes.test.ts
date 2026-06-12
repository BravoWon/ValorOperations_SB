// apps/web/__tests__/planes.test.ts
import { describe, it, expect } from 'vitest';
import { PLANES, planesForRole, minRoleForPath } from '@/lib/planes';
import { ALL_ROLES, ROLE_RANK } from '@/lib/role';

// The CURRENT route manifest — every registered hub route must appear here exactly once.
// (Started as the pre-Slice-A flat nav; each slice that adds a route also adds it here.)
const EXISTING_NAV = [
  '/dashboard', '/jobs', '/tickets', '/rig-day', '/assets',
  '/day', '/morning-report', '/tools/hydraulics', '/tools/directional',
  '/data-manager', '/template-builder', '/bank-editor', '/office-ops', '/data-studio', '/local-db', '/members',
];

describe('planes registry', () => {
  it('places every existing nav route in exactly one plane, no extras', () => {
    const hrefs = PLANES.flatMap((p) => p.items.map((i) => i.href));
    for (const route of EXISTING_NAV) {
      expect(hrefs.filter((h) => h === route)).toHaveLength(1);
    }
    expect(hrefs.length).toBe(EXISTING_NAV.length);
  });

  it('exposes the admin-only Members route in the Administer plane', () => {
    const administer = PLANES.find((p) => p.id === 'administer');
    const members = administer?.items.find((i) => i.href === '/members');
    expect(members).toBeDefined();
    expect(members?.minRole).toBe('admin');
    expect(minRoleForPath('/members')).toBe('admin');
    expect(planesForRole('admin').flatMap((p) => p.items.map((i) => i.href))).toContain('/members');
    expect(planesForRole('viewer').flatMap((p) => p.items.map((i) => i.href))).not.toContain('/members');
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
