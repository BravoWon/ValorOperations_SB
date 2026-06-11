import { DEMO_ORG_ID } from '@/lib/repo';
import { getServerRepo } from '@/lib/server-repo';
import { supabaseConfigured } from '@/lib/supabase/config';
import { staticParamsFor } from '@/lib/static-params';
import { WellSetupClient } from './setup-client';

// Pre-render a setup page per seeded well in mock/static-export mode. When
// Supabase is configured there is no session at build time — return [] so the
// route renders dynamically per request.
export async function generateStaticParams() {
  if (supabaseConfigured()) return [];
  const wells = await (await getServerRepo()).listWells(DEMO_ORG_ID);
  return staticParamsFor(wells.map((w) => ({ wellId: w.id })));
}

export default async function WellSetupPage({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  return <WellSetupClient wellId={wellId} />;
}
