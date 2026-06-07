import type { Job } from '@valor/core';
import { Activity, Flame, CalendarClock, type LucideIcon } from 'lucide-react';

type Tone = 'gold' | 'green' | 'cyan';

const TONE: Record<Tone, { text: string; ring: string; glow: string }> = {
  gold: { text: 'text-gold', ring: 'border-gold/30 bg-gold/10', glow: 'from-gold/[0.12]' },
  green: { text: 'text-green', ring: 'border-green/30 bg-green/10', glow: 'from-green/[0.1]' },
  cyan: { text: 'text-cyan', ring: 'border-cyan/30 bg-cyan/10', glow: 'from-cyan/[0.1]' },
};

export function KpiStrip({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter((j) => ['mobilized', 'executing', 'suspended'].includes(j.status)).length;
  const executing = jobs.filter((j) => j.status === 'executing').length;
  const planned = jobs.filter((j) => j.status === 'planned').length;

  const cards: { label: string; value: number; tone: Tone; icon: LucideIcon }[] = [
    { label: 'Active Jobs', value: active, tone: 'cyan', icon: Activity },
    { label: 'Executing', value: executing, tone: 'green', icon: Flame },
    { label: 'Planned', value: planned, tone: 'gold', icon: CalendarClock },
  ];

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c, i) => {
        const tone = TONE[c.tone];
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="glass animate-fade-up relative overflow-hidden rounded-lg p-5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div
              className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tone.glow} to-transparent blur-2xl`}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="data text-4xl font-semibold leading-none text-cream">
                  {c.value.toString().padStart(2, '0')}
                </div>
                <div className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {c.label}
                </div>
              </div>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-md border ${tone.ring}`}
              >
                <Icon className={`h-4 w-4 ${tone.text}`} strokeWidth={1.75} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
