import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Guards the env-gated repository factory (lib/repo.ts):
 *  - the mock MUST stay the default with no env;
 *  - Supabase engages only when ALL THREE vars are present — including the org
 *    UUID. (url+key without ORG_ID previously fell back to the non-UUID
 *    DEMO_ORG_ID, which breaks PostgREST's uuid org_id filters.)
 *
 * The `supabaseConfigured()` predicate is tested directly (it is the whole gate)
 * rather than constructing a SupabaseRepository — repo.ts lazy-`require`s the
 * ESM-only @supabase/supabase-js, which only resolves through Next's bundler,
 * not under vitest. The default-is-mock case is verified through getRepo().
 */
const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ORG_ID',
] as const;

describe('getRepo() factory gate', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('defaults to MockRepository when no Supabase env is set', async () => {
    vi.resetModules();
    const { getRepo } = await import('@/lib/repo');
    expect(getRepo().constructor.name).toBe('MockRepository');
  });

  it('gate is closed when no env is set', async () => {
    const { supabaseConfigured } = await import('@/lib/repo');
    expect(supabaseConfigured()).toBe(false);
  });

  it('gate stays closed with url + key but no ORG_ID (the regression guard)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const { supabaseConfigured } = await import('@/lib/repo');
    expect(supabaseConfigured()).toBe(false);
  });

  it('gate opens only when all three (incl. org UUID) are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = '00000000-0000-0000-0000-000000000001';
    const { supabaseConfigured } = await import('@/lib/repo');
    expect(supabaseConfigured()).toBe(true);
  });

  it('gate stays closed when ORG_ID is set but not a valid UUID (fail-safe to mock)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = 'org-valor'; // the mock seed id — not a UUID
    const { supabaseConfigured } = await import('@/lib/repo');
    expect(supabaseConfigured()).toBe(false);
  });

  it('getServerRepo() returns MockRepository when unconfigured', async () => {
    vi.resetModules();
    const { getServerRepo } = await import('@/lib/server-repo');
    const repo = await getServerRepo();
    expect(repo.constructor.name).toBe('MockRepository');
  });
});
