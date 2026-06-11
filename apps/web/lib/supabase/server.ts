import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server components only. Next 15: cookies() is async.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // From a Server Component the cookie store is read-only — middleware
          // refreshes the session cookie instead, so swallow the write.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* read-only in a Server Component render */
          }
        },
      },
    },
  );
}
