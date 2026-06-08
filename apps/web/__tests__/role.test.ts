// apps/web/__tests__/role.test.ts
import { describe, it, expect } from 'vitest';
import { roleSatisfies, parseRoleCookie, ROLE_RANK, ALL_ROLES } from '@/lib/role';

describe('roleSatisfies', () => {
  it('owner satisfies every minimum', () => {
    for (const r of ALL_ROLES) expect(roleSatisfies('owner', r)).toBe(true);
  });
  it('viewer satisfies only viewer', () => {
    expect(roleSatisfies('viewer', 'viewer')).toBe(true);
    expect(roleSatisfies('viewer', 'field')).toBe(false);
  });
  it('equal rank satisfies', () => {
    expect(roleSatisfies('ops', 'ops')).toBe(true);
  });
});

describe('parseRoleCookie', () => {
  it('reads a valid role from the cookie string', () => {
    expect(parseRoleCookie('a=1; valor_demo_role=field; b=2')).toBe('field');
  });
  it('defaults to owner when absent or invalid', () => {
    expect(parseRoleCookie('')).toBe('owner');
    expect(parseRoleCookie('valor_demo_role=bogus')).toBe('owner');
  });
  it('every role has a numeric rank', () => {
    for (const r of ALL_ROLES) expect(typeof ROLE_RANK[r]).toBe('number');
  });
});
