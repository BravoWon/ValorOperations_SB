'use client';

import { useEffect, useState } from 'react';
import { Check, Flag, History, Trash2 } from 'lucide-react';
import { BANK_SEED, snapTo5, type RigDay, type TimeBlock } from '@valor/core';

export interface RigDayEditorsProps {
  day: RigDay;
  onChange: (next: RigDay) => void;
  /** Open the recall/QC drawer for a block. */
  onSelect?: (id: string) => void;
}

const SELECT_CLASS =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const NUM_CLASS =
  'w-20 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

/**
 * A minute input that holds its keystrokes locally (so partial/unsnapped values
 * survive typing) and commits a 5-min-snapped value to the parent on blur.
 */
function MinuteInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (snapped: number) => void;
}) {
  const [text, setText] = useState(String(value));

  // Re-sync when the canonical value changes from outside (e.g. snap, reset).
  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <input
      aria-label={label}
      type="number"
      step={5}
      min={0}
      max={1440}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const snapped = snapTo5(Number(text));
        setText(String(snapped));
        onCommit(snapped);
      }}
      className={NUM_CLASS}
    />
  );
}

/**
 * Per-block edit rows: code select (over the Bank), start/end minute inputs that
 * snap to the 5-min grid on blur, and a remove button. Every edit re-emits the
 * whole RigDay so the page recomputes accounting live.
 */
export function RigDayEditors({ day, onChange, onSelect }: RigDayEditorsProps) {
  const update = (index: number, patch: Partial<TimeBlock>) => {
    const blocks = day.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b));
    onChange({ ...day, blocks });
  };

  const remove = (index: number) => {
    onChange({ ...day, blocks: day.blocks.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-1.5">
      {day.blocks.map((b, i) => (
        <div
          key={b.id}
          className="flex flex-wrap items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.012] px-2.5 py-1.5"
        >
          <select
            aria-label={`Code for block ${i + 1}`}
            value={b.code}
            onChange={(e) => update(i, { code: e.target.value })}
            className={SELECT_CLASS}
          >
            {BANK_SEED.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {`${opt.code} — ${opt.label}`}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/60">
            <span className="font-mono">Start</span>
            <MinuteInput
              label="Start (min)"
              value={b.startMin}
              onCommit={(snapped) => update(i, { startMin: snapped })}
            />
          </label>

          <label className="flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/60">
            <span className="font-mono">End</span>
            <MinuteInput
              label="End (min)"
              value={b.endMin}
              onCommit={(snapped) => update(i, { endMin: snapped })}
            />
          </label>

          {b.qc && (
            <span
              className={
                b.qc.status === 'approved'
                  ? 'ml-auto inline-flex items-center gap-1 rounded-sm border border-green/40 bg-green/10 px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-green'
                  : 'ml-auto inline-flex items-center gap-1 rounded-sm border border-red/40 bg-red/10 px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-red'
              }
            >
              {b.qc.status === 'approved' ? (
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Flag className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              )}
              {b.qc.status}
            </span>
          )}

          <button
            type="button"
            aria-label={`Recall / QC for block ${i + 1}`}
            onClick={() => onSelect?.(b.id)}
            className={`${b.qc ? '' : 'ml-auto '}rounded-md border border-gold/30 bg-gold/[0.06] p-1 text-gold-light transition-colors hover:bg-gold/[0.12]`}
          >
            <History className="h-3.5 w-3.5" strokeWidth={2} />
          </button>

          <button
            type="button"
            aria-label={`Remove block ${i + 1}`}
            onClick={() => remove(i)}
            className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ))}
      {day.blocks.length === 0 && (
        <p className="font-mono text-xs text-muted-foreground/50">
          No blocks yet — add one from the Bank.
        </p>
      )}
    </div>
  );
}
