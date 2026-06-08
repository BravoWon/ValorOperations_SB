'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ⚠️ DEMO PLACEHOLDER AUTH GATE — NOT REAL SECURITY (see middleware.ts).
 *
 * Client-side companion to the demo auth middleware. On statically-exported
 * hosting (GitHub Pages) middleware does not run, so this checks the same
 * `valor_demo_auth` cookie in the browser and redirects to /login when absent —
 * keeping the login → workspaces flow intact on static Pages. On dev / Vercel the
 * middleware already redirected, so by the time this mounts the cookie is present
 * and it renders children immediately. `useRouter().replace` is basePath-aware.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = document.cookie.split('; ').some((c) => c.startsWith('valor_demo_auth='));
    if (ok) {
      setAuthed(true);
    } else {
      setAuthed(false);
      router.replace('/login');
    }
  }, [router]);

  // While checking (or redirecting an unauthed visitor) render nothing so the
  // protected content never flashes for someone who isn't signed in.
  if (!authed) return null;
  return <>{children}</>;
}
