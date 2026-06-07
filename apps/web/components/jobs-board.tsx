import type { Job, JobStatus } from '@valor/core';

// Board shows the in-flight lifecycle columns. `suspended`/`closed` jobs are counted in
// the KPI strip but not given a column here; revisit column set when those states see real use.
const COLUMNS: { status: JobStatus; title: string }[] = [
  { status: 'planned', title: 'Planned' },
  { status: 'mobilized', title: 'Mobilized' },
  { status: 'executing', title: 'Executing' },
  { status: 'complete', title: 'Complete' },
];

export function JobsBoard({ jobs }: { jobs: Job[] }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.status);
        return (
          <div key={col.status} className="rounded-lg bg-slate-200/60 p-3">
            <div className="mb-3 text-sm font-medium text-slate-600">
              {col.title} <span className="text-slate-400">({colJobs.length})</span>
            </div>
            <div className="space-y-2">
              {colJobs.map((j) => (
                <div key={j.id} className="rounded-md bg-white p-3 shadow-sm">
                  <div className="text-sm font-medium">{j.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {j.jobType} · {j.afeNumber ?? 'no AFE'}
                  </div>
                </div>
              ))}
              {colJobs.length === 0 && <div className="text-xs text-slate-400">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
