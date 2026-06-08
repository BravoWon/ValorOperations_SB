import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { WellSetupClient } from './setup-client';

// Pre-render a setup page per seeded well for static export. The interactive
// editor lives in the client component; this server wrapper only enumerates the
// dynamic params and forwards the wellId.
export async function generateStaticParams() {
  const wells = await getRepo().listWells(DEMO_ORG_ID);
  return wells.map((w) => ({ wellId: w.id }));
}

export default async function WellSetupPage({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  return <WellSetupClient wellId={wellId} />;
}
