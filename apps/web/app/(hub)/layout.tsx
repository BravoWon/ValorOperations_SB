import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { AppShell } from '@/components/app-shell';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);
  return <AppShell tree={tree}>{children}</AppShell>;
}
