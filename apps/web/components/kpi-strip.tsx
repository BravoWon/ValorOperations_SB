import type { Job } from '@valor/core';

export function KpiStrip({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter((j) => ['mobilized', 'executing', 'suspended'].includes(j.status)).length;
  const executing = jobs.filter((j) => j.status === 'executing').length;
  const planned = jobs.filter((j) => j.status === 'planned').length;

  const cards = [
    { label: 'Active jobs', value: active },
    { label: 'Executing', value: executing },
    { label: 'Planned', value: planned },
  ];

  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold">{c.value}</div>
          <div className="text-sm text-slate-500">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
