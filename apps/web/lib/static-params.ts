import { supabaseConfigured } from '@/lib/supabase/config';

/**
 * Gate build-time `generateStaticParams`: when Supabase is configured there is no
 * session at build, so we cannot (and must not) enumerate per-org ids — return []
 * and let the route render dynamically per request. In mock / static-export mode
 * (unconfigured) enumerate as before so the static export is complete.
 */
export function staticParamsFor<T>(params: T[]): T[] {
  return supabaseConfigured() ? [] : params;
}
