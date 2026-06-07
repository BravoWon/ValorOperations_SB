import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { KpiStrip } from '@/components/kpi-strip';
import { JobsBoard } from '@/components/jobs-board';
import { PageHeader } from '@/components/ui/page-header';

export default async function JobsPage() {
  const repo = getRepo();
  const jobs = await repo.listJobs(DEMO_ORG_ID);

  return (
    <div>
      <PageHeader
        eyebrow="Field Operations"
        title="Active Jobs"
        subtitle="Live lifecycle status across every rig and workover in the Valor portfolio."
      />
      <KpiStrip jobs={jobs} />
      <JobsBoard jobs={jobs} />
    </div>
  );
}
