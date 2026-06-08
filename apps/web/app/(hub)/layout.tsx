import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { RoleProvider } from '@/components/role-provider';
import { RoleGate } from '@/components/role-gate';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);

  // RoleProvider must wrap both the sidebar (role-filtered nav) and RoleGate
  // (direct-visit gate) so they share one role. RoleGate wraps the page content.
  const shell = (
    <AppShell tree={tree}>
      <RoleGate>{children}</RoleGate>
    </AppShell>
  );

  // Static export (GitHub Pages) also needs the client AuthGate (no middleware there);
  // dev/Vercel are gated by middleware, so AuthGate is skipped to keep SSR HTML.
  const gated = process.env.STATIC_EXPORT === 'true' ? <AuthGate>{shell}</AuthGate> : shell;

  return <RoleProvider>{gated}</RoleProvider>;
}
