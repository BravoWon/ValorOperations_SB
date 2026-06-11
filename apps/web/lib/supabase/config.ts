// Lightweight, dependency-free auth/config helpers safe to import from middleware
// (no @valor/core). The env gate that decides whether the app talks to Supabase.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** All three vars required; ORG_ID must be the org's UUID (no fallback). */
export function supabaseConfigured(): boolean {
  const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      orgId &&
      UUID_RE.test(orgId),
  );
}

/** Paths reachable without a session (the sign-in flow itself). */
export const PUBLIC_PATHS = ['/login', '/auth/callback'];

/** Pure middleware decision: should this request be redirected to /login? */
export function decideAuth(configured: boolean, hasSession: boolean, pathname: string): 'pass' | 'redirect' {
  if (!configured) return 'pass';
  if (PUBLIC_PATHS.includes(pathname)) return 'pass';
  return hasSession ? 'pass' : 'redirect';
}
