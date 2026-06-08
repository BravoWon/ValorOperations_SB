import { MockRepository, DEMO_ORG_ID, type Repository } from '@valor/core';

// Memoized in-process singleton for the data layer. By default this is the
// in-memory MockRepository — the running app is byte-for-byte unchanged unless
// Supabase env vars are present (see below). When NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY are both set, the factory constructs a
// SupabaseRepository instead (scaffold — see lib/supabase-repository.ts).
let instance: Repository | null = null;

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function createRepo(): Repository {
  if (supabaseConfigured()) {
    // Lazy require so @supabase/supabase-js + the adapter are never pulled into
    // the default (mock) path — keeps the unconfigured app identical to before.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SupabaseRepository } = require('./supabase-repository') as typeof import('./supabase-repository');
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
    // Demo deployment resolves to a single configured default org. A real
    // multi-tenant build would derive the org from the authenticated session.
    const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID ?? DEMO_ORG_ID;
    return new SupabaseRepository(client, orgId);
  }
  return new MockRepository();
}

export function getRepo(): Repository {
  if (!instance) instance = createRepo();
  return instance;
}

export { DEMO_ORG_ID };
