import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { KpiStrip } from '@/components/kpi-strip';
import { JobsBoard } from '@/components/jobs-board';

export default async function JobsPage() {
  const repo = getRepo();
  const jobs = await repo.listJobs(DEMO_ORG_ID);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Active Jobs</h1>
      <KpiStrip jobs={jobs} />
      <JobsBoard jobs={jobs} />
    </div>
  );
}
