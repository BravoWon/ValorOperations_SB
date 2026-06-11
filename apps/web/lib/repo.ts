import { MockRepository, DEMO_ORG_ID, type Repository } from '@valor/core';
import { supabaseConfigured } from './supabase/config';
export { supabaseConfigured };
import { resolveActiveOrgClient } from './active-org';

// Memoized in-process singleton for the data layer. By default this is the
// in-memory MockRepository — the running app is byte-for-byte unchanged unless
// Supabase is fully configured (see below). Enabling Supabase requires all
// three of NEXT_PUBLIC_SUPABASE_URL, _ANON_KEY, and _ORG_ID (a valid UUID);
// only then does the factory construct a SupabaseRepository (scaffold — see
// supabase-repository.ts). The gate logic lives in lib/supabase/config.ts so
// the Next.js middleware can import it without pulling in @valor/core.
let instance: Repository | null = null;

function createRepo(): Repository {
  if (supabaseConfigured()) {
    // Lazy require so the browser client + the adapter are never pulled into
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
    const { createSupabaseBrowserClient } = require('./supabase/browser') as typeof import('./supabase/browser');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SupabaseRepository } = require('./supabase-repository') as typeof import('./supabase-repository');
    // Resolves from document.cookie (active-org cookie) with env-var fallback.
    // No DEMO_ORG_ID fallback here: that would reintroduce the uuid mismatch.
    const orgId = resolveActiveOrgClient();
    return new SupabaseRepository(createSupabaseBrowserClient(), orgId);
  }
  return new MockRepository();
}

export function getRepo(): Repository {
  if (!instance) instance = createRepo();
  return instance;
}

export { DEMO_ORG_ID };
