import { DEMO_ORG_ID } from '@/lib/repo';
import { getServerRepo } from '@/lib/server-repo';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { RoleProvider } from '@/components/role-provider';
import { RoleGate } from '@/components/role-gate';
import { RequireMembership } from '@/components/require-membership';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const tree = await (await getServerRepo()).getAssetTree(DEMO_ORG_ID);

  // RoleProvider must wrap both the sidebar (role-filtered nav) and RoleGate
  // (direct-visit gate) so they share one role. RoleGate wraps the page content.
  const shell = (
    <AppShell tree={tree}>
      <RequireMembership>
        <RoleGate>{children}</RoleGate>
      </RequireMembership>
    </AppShell>
  );

  // Static export (GitHub Pages) also needs the client AuthGate (no middleware there);
  // dev/Vercel are gated by middleware, so AuthGate is skipped to keep SSR HTML.
  const gated = process.env.STATIC_EXPORT === 'true' ? <AuthGate>{shell}</AuthGate> : shell;

  return <RoleProvider>{gated}</RoleProvider>;
}
