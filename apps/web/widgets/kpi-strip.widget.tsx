'use client';
import { registerWidget } from '@/lib/widgets/registry';
import { KpiStrip } from '@/components/kpi-strip';
import { useRepoData } from '@/lib/use-repo-data';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { LoadingState } from '@/components/ui/states';

function KpiStripWidget() {
  const { data } = useRepoData(() => getRepo().listJobs(DEMO_ORG_ID));
  return data ? <KpiStrip jobs={data} /> : <LoadingState />;
}

registerWidget(
  { id: 'kpi-strip', title: 'KPI Strip', description: 'Active / executing / planned job counts.', category: 'data', defaultSize: { w: 12, h: 2 }, minSize: { w: 4, h: 2 } },
  KpiStripWidget,
);
export {};
