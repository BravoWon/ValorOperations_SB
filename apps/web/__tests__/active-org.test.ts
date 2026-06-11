import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACTIVE_ORG_COOKIE, readActiveOrgCookie, resolveActiveOrgClient, writeActiveOrgCookie } from '@/lib/active-org';

const ENV = '00000000-0000-0000-0000-0000000000ee';
const prev = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = ENV;
  document.cookie = `${ACTIVE_ORG_COOKIE}=; path=/; max-age=0`; // clear
});
afterEach(() => {
  if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ORG_ID;
  else process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = prev;
});

describe('readActiveOrgCookie', () => {
  it('returns the value when present', () => { expect(readActiveOrgCookie('abc')).toBe('abc'); });
  it('falls back to the env default when undefined or empty', () => {
    expect(readActiveOrgCookie(undefined)).toBe(ENV);
    expect(readActiveOrgCookie('')).toBe(ENV);
  });
});

describe('resolveActiveOrgClient + writeActiveOrgCookie', () => {
  it('returns the env default when no cookie is set', () => { expect(resolveActiveOrgClient()).toBe(ENV); });
  it('round-trips a written cookie', () => {
    writeActiveOrgCookie('org-123');
    expect(resolveActiveOrgClient()).toBe('org-123');
  });
});
