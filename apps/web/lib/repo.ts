import { MockRepository, DEMO_ORG_ID, type Repository } from '@valor/core';
import { supabaseConfigured } from './supabase/config';
export { supabaseConfigured };

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
    // SCAFFOLD LIMITATION (auth not yet wired): this is a plain anon-key client
    // held as a module singleton. The RLS policies are `TO authenticated`, so
    // until Supabase Auth is wired AND a per-request SSR client is used (e.g.
    // @supabase/ssr, with the user's session cookies/headers), queries run as the
    // anon role and RLS returns no rows / rejects writes. Wiring auth + the SSR
    // client is the documented next step in supabase/README.md (Known limitations).
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
