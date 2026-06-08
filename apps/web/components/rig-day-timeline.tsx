'use client';

import { DAY_MINUTES, findBankCode, type RigDay } from '@valor/core';

export interface RigDayTimelineProps {
  day: RigDay;
}

/**
 * Category → bar fill. NPT categories use the red accent so trouble time reads
 * at a glance; productive categories ride the navy/gold/cyan brand palette.
 * Print-clean: solid fills, gold gridlines, no glassmorphism inside the track.
 */
const CATEGORY_COLOR: Record<string, string> = {
  'Make Hole': '#C9A24B', // gold — the core productive activity
  'Pipe Movement': '#4FA3C7', // cyan
  'Casing/Cement': '#7D8BB0', // slate
  'Pressure/BOP': '#5B8C7A', // teal-green
  Evaluation: '#B08AC9', // violet
  'Trouble (NPT)': '#C0504D', // red accent
  Service: '#9A8C6B', // muted gold
};
const FALLBACK_COLOR = '#52627E';

function colorForCode(code: string): string {
  const bank = findBankCode(code);
  if (!bank) return FALLBACK_COLOR;
  return CATEGORY_COLOR[bank.category] ?? FALLBACK_COLOR;
}

function pct(min: number): string {
  return `${(min / DAY_MINUTES) * 100}%`;
}

function hhmm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24 gridlines

export function RigDayTimeline({ day }: RigDayTimelineProps) {
  const blocks = day.blocks;
  const nowMin = blocks.length ? Math.max(...blocks.map((b) => b.endMin)) : 0;

  return (
    <div className="select-none">
      {/* Hour axis labels */}
      <div className="relative mb-1 h-4">
        {HOURS.filter((h) => h % 3 === 0).map((h) => (
          <span
            key={`axis-${h}`}
            className="absolute top-0 -translate-x-1/2 font-mono text-[0.625rem] text-muted-foreground/60"
            style={{ left: pct(h * 60) }}
          >
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>

      {/* The track */}
      <div
        data-testid="rig-day-track"
        className="relative h-16 w-full overflow-hidden rounded-md border border-gold/15 bg-background/40"
        role="img"
        aria-label={`Rig day timeline: ${day.label}`}
      >
        {/* Hour gridlines */}
        {HOURS.map((h) => (
          <div
            key={`grid-${h}`}
            className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.06]"
            style={{ left: pct(h * 60) }}
            aria-hidden="true"
          />
        ))}

        {/* Coded activity blocks */}
        {blocks.map((b) => {
          const dur = b.endMin - b.startMin;
          const color = colorForCode(b.code);
          return (
            <div
              key={b.id}
              data-testid="rig-block"
              title={`${b.code} · ${hhmm(b.startMin)}–${hhmm(b.endMin)}`}
              className="absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-[3px] px-1"
              style={{
                left: pct(b.startMin),
                width: pct(Math.max(0, dur)),
                backgroundColor: color,
              }}
            >
              <span className="truncate font-mono text-[0.625rem] font-semibold uppercase tracking-wide text-[#0D1E35]">
                {b.code}
              </span>
            </div>
          );
        })}

        {/* "Now" marker at the end of the last logged block */}
        {nowMin > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-gold-light shadow-[0_0_8px_0_rgba(227,198,119,0.8)]"
            style={{ left: pct(nowMin) }}
            aria-label={`Now: ${hhmm(nowMin)}`}
          >
            <span className="absolute -top-px left-1 font-mono text-[0.5625rem] uppercase tracking-wider text-gold-light">
              now
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
