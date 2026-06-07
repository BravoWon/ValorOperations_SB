'use client';
import { registerWidget } from '@/lib/widgets/registry';
import { JobsBoard } from '@/components/jobs-board';
import { useRepoData } from '@/lib/use-repo-data';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';

function ActiveJobsWidget() {
  const { data } = useRepoData(() => getRepo().listJobs(DEMO_ORG_ID));
  return data ? <JobsBoard jobs={data} /> : <div className="text-xs text-muted-foreground">Loading…</div>;
}

registerWidget(
  { id: 'active-jobs', title: 'Active Jobs', description: 'Jobs by lifecycle phase.', category: 'data', defaultSize: { w: 8, h: 8 }, minSize: { w: 4, h: 5 } },
  ActiveJobsWidget,
);
export {};
