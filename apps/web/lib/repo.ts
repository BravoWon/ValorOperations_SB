import { MockRepository, DEMO_ORG_ID, type Repository } from '@valor/core';

// Memoized in-process singleton for the data layer. By default this is the
// in-memory MockRepository — the running app is byte-for-byte unchanged unless
// Supabase is fully configured (see below). Enabling Supabase requires all
// three of NEXT_PUBLIC_SUPABASE_URL, _ANON_KEY, and _ORG_ID; only then does the
// factory construct a SupabaseRepository (scaffold — see supabase-repository.ts).
let instance: Repository | null = null;

// The org id MUST be the UUID of the org row in Supabase. The schema types every
// org_id column as `uuid`, so a non-UUID (e.g. the mock seed DEMO_ORG_ID,
// 'org-valor') would make PostgREST's org_id filters error or match nothing.
// Hence org id is part of the "configured" gate and has no fallback on the
// Supabase path — the mock path keeps using DEMO_ORG_ID, where it is valid.
// Exported for the factory-gate test. All three vars are required to engage
// Supabase; ORG_ID specifically must be the org's UUID (no fallback).
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ORG_ID,
  );
}

function createRepo(): Repository {
  if (supabaseConfigured()) {
    // Lazy require so @supabase/supabase-js + the adapter are never pulled into
    // the default (mock) path — keeps the unconfigured app identical to before.
    //
    // This module only runs inside the Next.js bundle (the gate is on
    // NEXT_PUBLIC_* vars), and Next's bundler transpiles this `require` of the
    // ESM-only supabase-js — the production build resolves it cleanly. A
    // top-level static import would defeat the bundle-splitting above (pulling
    // supabase-js into every mock build); `await import()` would force getRepo()
    // async and ripple through every caller for no benefit in the only
    // (bundled) environment this runs in. Hence the deliberate lazy require.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SupabaseRepository } = require('./supabase-repository') as typeof import('./supabase-repository');
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
    // Guaranteed present (and intended to be the org's UUID) by the gate above.
    // No DEMO_ORG_ID fallback here: that would reintroduce the uuid mismatch.
    const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string;
    return new SupabaseRepository(client, orgId);
  }
  return new MockRepository();
}

export function getRepo(): Repository {
  if (!instance) instance = createRepo();
  return instance;
}

export { DEMO_ORG_ID };
