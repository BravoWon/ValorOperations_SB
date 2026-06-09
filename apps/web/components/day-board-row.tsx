import Link from 'next/link';
import { DAY_MINUTES, findBankCode, type RigDay } from '@valor/core';

export interface DayBoardRowProps {
  day: RigDay;
  href: string;
}

// Category tinting mirrors rig-day-timeline.tsx (the detail view owns the canonical map;
// kept local here because that component is intentionally not modified by this slice).
const CATEGORY_COLOR: Record<string, string> = {
  'Make Hole': '#C9A24B',
  'Pipe Movement': '#4FA3C7',
  'Casing/Cement': '#7D8BB0',
  'Pressure/BOP': '#5B8C7A',
  Evaluation: '#B08AC9',
  'Trouble (NPT)': '#C0504D',
  Service: '#9A8C6B',
};
const FALLBACK_COLOR = '#52627E';

function colorForCode(code: string): string {
  const bank = findBankCode(code);
  return bank ? (CATEGORY_COLOR[bank.category] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

function pct(min: number): string {
  return `${(min / DAY_MINUTES) * 100}%`;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);

/** Gutter sizing shared with the board's axis spacer so labels and tracks stay aligned. */
export const DAY_BOARD_GUTTER_CLASS = 'w-40 shrink-0';

/** One compact section row on the shared 24h axis. Read-only; the row links to the ticket. */
export function DayBoardRow({ day, href }: DayBoardRowProps) {
  const n = day.blocks.length;
  return (
    <Link
      href={href}
      data-testid="day-board-row"
      aria-label={`Open ${day.label} timeline`}
      className="group flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-white/[0.03]"
    >
      <div className={DAY_BOARD_GUTTER_CLASS}>
        <div className="truncate font-mono text-xs text-cream group-hover:text-gold-light">{day.label}</div>
        <div className="font-mono text-[0.625rem] text-muted-foreground/60">{n} {n === 1 ? 'block' : 'blocks'}</div>
      </div>
      <div className="relative h-8 flex-1 overflow-hidden rounded-md border border-gold/15 bg-background/40">
        {HOURS.map((h) => (
          <div
            key={`grid-${h}`}
            className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.06]"
            style={{ left: pct(h * 60) }}
            aria-hidden="true"
          />
        ))}
        {day.blocks.map((b) => (
          <div
            key={b.id}
            data-testid="day-board-block"
            title={`${b.code} ${b.startMin}–${b.endMin} min`}
            className="absolute inset-y-1 rounded-[2px]"
            style={{ left: pct(b.startMin), width: pct(Math.max(0, b.endMin - b.startMin)), backgroundColor: colorForCode(b.code) }}
          />
        ))}
      </div>
    </Link>
  );
}
