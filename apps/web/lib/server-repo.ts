import { MockRepository, type Repository } from '@valor/core';
import { supabaseConfigured } from './supabase/config';
import { ACTIVE_ORG_COOKIE, readActiveOrgCookie } from './active-org';

/** Server-component data layer: builds a SupabaseRepository over the request's
 *  session (cookies via next/headers) when configured; else the mock.
 *
 *  Kept in a separate module from lib/repo.ts so that client components that
 *  import lib/repo.ts do not trigger Next.js's static "next/headers in client
 *  bundle" error — webpack traces dynamic import() paths at build time. */
export async function getServerRepo(): Promise<Repository> {
  if (supabaseConfigured()) {
    const { createSupabaseServerClient } = await import('./supabase/server');
    const { SupabaseRepository } = await import('./supabase-repository');
    const { cookies } = await import('next/headers');
    const store = await cookies();
    const orgId = readActiveOrgCookie(store.get(ACTIVE_ORG_COOKIE)?.value);
    return new SupabaseRepository(await createSupabaseServerClient(), orgId);
  }
  return new MockRepository();
}
