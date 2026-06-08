import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);
  const shell = <AppShell tree={tree}>{children}</AppShell>;

  // Only wrap with the client AuthGate in static-export builds (GitHub Pages),
  // where the auth middleware can't run. On dev / `next start` / Vercel the
  // middleware gates server-side, so we skip AuthGate to keep the hub's HTML
  // server-rendered (AuthGate renders null until hydration → a blank-until-hydrate
  // flash we don't want when middleware already did the job).
  if (process.env.STATIC_EXPORT === 'true') {
    return <AuthGate>{shell}</AuthGate>;
  }
  return shell;
}
