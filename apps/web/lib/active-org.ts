export const ACTIVE_ORG_COOKIE = 'valor_active_org';

/** Pure: a raw cookie value, or the env default when absent/empty. */
export function readActiveOrgCookie(value: string | undefined): string {
  return value && value.length > 0 ? value : (process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string);
}

/** Client: resolve the active org from `document.cookie`, else the env default. */
export function resolveActiveOrgClient(): string {
  const raw = typeof document !== 'undefined'
    ? document.cookie.split('; ').find((c) => c.startsWith(`${ACTIVE_ORG_COOKIE}=`))
    : undefined;
  const value = raw ? decodeURIComponent(raw.slice(ACTIVE_ORG_COOKIE.length + 1)) : undefined;
  return readActiveOrgCookie(value);
}

/** Client: persist the active-org choice. Not httpOnly (the client reads it; RLS enforces access). */
export function writeActiveOrgCookie(orgId: string): void {
  document.cookie = `${ACTIVE_ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; max-age=31536000; samesite=lax`;
}
