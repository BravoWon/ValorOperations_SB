import type { Job, JobStatus } from '@valor/core';

// Board shows the in-flight lifecycle columns. `suspended`/`closed` jobs are counted in
// the KPI strip but not given a column here; revisit column set when those states see real use.
const COLUMNS: { status: JobStatus; title: string; dot: string; accent: string }[] = [
  { status: 'planned', title: 'Planned', dot: 'bg-muted-foreground/60', accent: 'text-muted-foreground' },
  { status: 'mobilized', title: 'Mobilized', dot: 'bg-gold', accent: 'text-gold' },
  { status: 'executing', title: 'Executing', dot: 'bg-green', accent: 'text-green' },
  { status: 'complete', title: 'Complete', dot: 'bg-cyan', accent: 'text-cyan' },
];

export function JobsBoard({ jobs }: { jobs: Job[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col, ci) => {
        const colJobs = jobs.filter((j) => j.status === col.status);
        return (
          <div
            key={col.status}
            className="animate-fade-up flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.015] p-3"
            style={{ animationDelay: `${ci * 60}ms` }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-cream">
                  {col.title}
                </span>
              </div>
              <span className={`data text-xs ${col.accent}`}>
                {colJobs.length.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="space-y-2.5">
              {colJobs.map((j) => (
                <div
                  key={j.id}
                  className="glass group relative overflow-hidden rounded-md p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/30"
                >
                  <span
                    className={`absolute left-0 top-0 h-full w-[2px] ${col.dot} opacity-60 transition-opacity group-hover:opacity-100`}
                  />
                  <div className="font-display text-sm font-medium leading-snug text-cream">
                    {j.name}
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                    <span className="rounded-sm bg-white/[0.05] px-1.5 py-0.5 text-gold/80">
                      {j.jobType}
                    </span>
                    <span className="text-muted-foreground/70">{j.afeNumber ?? 'no AFE'}</span>
                  </div>
                </div>
              ))}
              {colJobs.length === 0 && (
                <div className="rounded-md border border-dashed border-white/[0.07] px-3 py-6 text-center font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground/40">
                  None
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
