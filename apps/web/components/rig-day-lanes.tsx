'use client';

import {
  DAY_MINUTES,
  findEquipmentCategory,
  findPartyRole,
  type LaneItem,
  type ProgressPoint,
  type RigDay,
} from '@valor/core';

export interface RigDayLanesProps {
  day: RigDay;
  progress: ProgressPoint[];
}

/** Shared 24h x-axis: minutes → percent across the track. */
const minToPct = (m: number): number => (m / DAY_MINUTES) * 100;

/**
 * Party-role group → bar fill, keyed to the Valor palette so who's on location
 * reads by category at a glance. Print-clean: solid fills, no glass inside lanes.
 */
const PARTY_GROUP_COLOR: Record<string, string> = {
  Operator: '#C9A24B', // gold — the operator's own people
  Service: '#4FA3C7', // cyan — directional / MWD / mud
  Vendor: '#7D8BB0', // slate — cement / wireline / hauling
  Visitor: '#B08AC9', // violet — inspectors / visitors
};

/** Equipment-category group → bar fill. */
const EQUIP_GROUP_COLOR: Record<string, string> = {
  Rig: '#C9A24B', // gold — the rig itself
  Circulation: '#4FA3C7', // cyan — mud pumps
  Pressure: '#5B8C7A', // teal-green — BOP
  Fluids: '#7D8BB0', // slate — tanks / pits
  Power: '#9A8C6B', // muted gold — generators
  Service: '#4FA3C7', // cyan — wireline / cement units
  Downhole: '#B08AC9', // violet — tools / BHA
};

const FALLBACK_COLOR = '#52627E';

function partyColor(code: string): string {
  const group = findPartyRole(code)?.group;
  return (group && PARTY_GROUP_COLOR[group]) || FALLBACK_COLOR;
}

function equipColor(code: string): string {
  const group = findEquipmentCategory(code)?.group;
  return (group && EQUIP_GROUP_COLOR[group]) || FALLBACK_COLOR;
}

function hhmm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24 gridlines

/** A single coded-time-span lane (people or equipment). */
function SpanLane({
  items,
  testId,
  colorFor,
  nowMin,
  emptyLabel,
}: {
  items: LaneItem[];
  testId: string;
  colorFor: (code: string) => string;
  nowMin: number;
  emptyLabel: string;
}) {
  return (
    <div
      className="relative h-12 w-full overflow-hidden rounded-md border border-gold/15 bg-background/40"
      role="img"
    >
      {/* Hour gridlines */}
      {HOURS.map((h) => (
        <div
          key={`grid-${h}`}
          className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.06]"
          style={{ left: `${minToPct(h * 60)}%` }}
          aria-hidden="true"
        />
      ))}

      {items.map((it) => {
        const dur = it.endMin - it.startMin;
        return (
          <div
            key={it.id}
            data-testid={testId}
            title={`${it.code} · ${it.label} · ${hhmm(it.startMin)}–${hhmm(it.endMin)}`}
            aria-label={`${it.label} (${it.code}) ${hhmm(it.startMin)}–${hhmm(it.endMin)}`}
            className="absolute inset-y-1.5 flex items-center overflow-hidden rounded-[3px] px-1.5"
            style={{
              left: `${minToPct(it.startMin)}%`,
              width: `${minToPct(Math.max(0, dur))}%`,
              backgroundColor: colorFor(it.code),
            }}
          >
            <span className="truncate text-[0.625rem] font-semibold text-[#0D1E35]">
              {it.label}
            </span>
          </div>
        );
      })}

      {items.length === 0 && (
        <span className="absolute inset-0 flex items-center pl-2 font-mono text-[0.625rem] text-muted-foreground/50">
          {emptyLabel}
        </span>
      )}

      {/* Shared "now" marker */}
      {nowMin > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-gold-light shadow-[0_0_8px_0_rgba(227,198,119,0.8)]"
          style={{ left: `${minToPct(nowMin)}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

const PROGRESS_W = 1000;
const PROGRESS_H = 120;

/** Depth-vs-time progress curve (deeper = lower), derived from activity blocks. */
function ProgressLane({ progress, nowMin }: { progress: ProgressPoint[]; nowMin: number }) {
  if (progress.length === 0) {
    return (
      <div className="relative flex h-[120px] w-full items-center justify-center rounded-md border border-gold/15 bg-background/40">
        <span className="font-mono text-[0.6875rem] text-muted-foreground/50">
          No depth logged yet — add depths to activity blocks to chart progress.
        </span>
      </div>
    );
  }

  const depths = progress.map((p) => p.depthFt);
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);
  const span = maxDepth - minDepth || 1; // avoid div-by-zero on a flat curve

  const x = (atMin: number) => (atMin / DAY_MINUTES) * PROGRESS_W;
  // Shallowest near the top, deepest near the bottom (inverted depth axis), with
  // a little vertical padding so the line never rides the edges.
  const PAD = 8;
  const y = (depthFt: number) =>
    PAD + ((depthFt - minDepth) / span) * (PROGRESS_H - 2 * PAD);

  const points = progress.map((p) => `${x(p.atMin).toFixed(1)},${y(p.depthFt).toFixed(1)}`).join(' ');
  const currentDepth = progress[progress.length - 1]!.depthFt;

  return (
    <div className="relative h-[120px] w-full overflow-hidden rounded-md border border-gold/15 bg-background/40">
      <svg
        viewBox={`0 0 ${PROGRESS_W} ${PROGRESS_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Drilling progress: depth vs time"
      >
        {/* Hour gridlines */}
        {HOURS.map((h) => (
          <line
            key={`pgrid-${h}`}
            x1={(h * 60 * PROGRESS_W) / DAY_MINUTES}
            x2={(h * 60 * PROGRESS_W) / DAY_MINUTES}
            y1={0}
            y2={PROGRESS_H}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        <polyline
          data-testid="progress-path"
          points={points}
          fill="none"
          stroke="#C9A24B"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {nowMin > 0 && (
          <line
            x1={(nowMin * PROGRESS_W) / DAY_MINUTES}
            x2={(nowMin * PROGRESS_W) / DAY_MINUTES}
            y1={0}
            y2={PROGRESS_H}
            stroke="#E3C677"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="absolute right-2 top-1.5 rounded-sm bg-background/70 px-1.5 py-0.5 font-mono text-[0.625rem] text-gold-light">
        {`${Math.round(currentDepth).toLocaleString()} ft MD`}
      </div>
    </div>
  );
}

/**
 * The time-aligned keystone: people, equipment, and progress swimlanes stacked
 * under the activity timeline, all sharing the 24h / 5-min x-axis (one
 * `minToPct`) and a "now" marker at the end of the last logged block.
 */
export function RigDayLanes({ day, progress }: RigDayLanesProps) {
  const people = day.people ?? [];
  const equipment = day.equipment ?? [];
  const blocks = day.blocks ?? [];
  const nowMin = blocks.length ? Math.max(...blocks.map((b) => b.endMin)) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="eyebrow">People on Location</div>
        <SpanLane
          items={people}
          testId="person-item"
          colorFor={partyColor}
          nowMin={nowMin}
          emptyLabel="No people logged — add from the catalog."
        />
      </div>

      <div className="space-y-1.5">
        <div className="eyebrow">Equipment on Location</div>
        <SpanLane
          items={equipment}
          testId="equipment-item"
          colorFor={equipColor}
          nowMin={nowMin}
          emptyLabel="No equipment logged — add from the catalog."
        />
      </div>

      <div className="space-y-1.5">
        <div className="eyebrow">Progress — Depth vs Time</div>
        <ProgressLane progress={progress} nowMin={nowMin} />
      </div>
    </div>
  );
}
