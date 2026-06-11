import { MockRepository, type Repository } from '@valor/core';
import { supabaseConfigured } from './supabase/config';

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
    const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string;
    return new SupabaseRepository(await createSupabaseServerClient(), orgId);
  }
  return new MockRepository();
}
