import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);
  // AuthGate handles the client-side redirect on static hosting (where the auth
  // middleware doesn't run); middleware still covers dev / Vercel.
  return (
    <AuthGate>
      <AppShell tree={tree}>{children}</AppShell>
    </AuthGate>
  );
}
