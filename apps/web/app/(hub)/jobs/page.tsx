import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { KpiStrip } from '@/components/kpi-strip';
import { JobsBoard } from '@/components/jobs-board';

export default async function JobsPage() {
  const repo = getRepo();
  const jobs = await repo.listJobs(DEMO_ORG_ID);

  return (
    <div>
      <header className="mb-8">
        <div className="eyebrow mb-2">Field Operations</div>
        <h1 className="font-display text-3xl font-medium tracking-tight text-cream">
          Active Jobs
        </h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Live lifecycle status across every rig and workover in the Valor portfolio.
        </p>
      </header>
      <KpiStrip jobs={jobs} />
      <JobsBoard jobs={jobs} />
    </div>
  );
}
