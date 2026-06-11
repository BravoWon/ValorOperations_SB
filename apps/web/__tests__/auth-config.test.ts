import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseConfigured, decideAuth } from '@/lib/supabase/config';

const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ORG_ID'] as const;

describe('supabaseConfigured', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  it('is false with nothing set', () => { expect(supabaseConfigured()).toBe(false); });
  it('is false with url+key but no org id', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'k';
    expect(supabaseConfigured()).toBe(false);
  });
  it('is false when org id is not a uuid', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'k';
    process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = 'org-valor';
    expect(supabaseConfigured()).toBe(false);
  });
  it('is true with all three (uuid org id)', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'k';
    process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = '00000000-0000-0000-0000-000000000001';
    expect(supabaseConfigured()).toBe(true);
  });
});

describe('decideAuth', () => {
  it('passes everything when unconfigured', () => {
    expect(decideAuth(false, false, '/tickets')).toBe('pass');
  });
  it('passes public paths even without a session', () => {
    expect(decideAuth(true, false, '/login')).toBe('pass');
    expect(decideAuth(true, false, '/auth/callback')).toBe('pass');
  });
  it('redirects a protected path without a session', () => {
    expect(decideAuth(true, false, '/tickets')).toBe('redirect');
  });
  it('passes a protected path with a session', () => {
    expect(decideAuth(true, true, '/tickets')).toBe('pass');
  });
  it('treats a public path with a trailing slash as public', () => {
    expect(decideAuth(true, false, '/auth/callback/')).toBe('pass');
  });
});
