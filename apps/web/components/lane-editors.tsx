'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { snapTo5, type CatalogCode, type LaneItem } from '@valor/core';

export interface LaneEditorsProps {
  title: string;
  items: LaneItem[];
  catalog: CatalogCode[];
  onChange: (next: LaneItem[]) => void;
  /** Deterministic id stem, e.g. "p" → "p-1". No Date.now()/Math.random(). */
  idPrefix: string;
}

const SELECT_CLASS =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const TEXT_CLASS =
  'min-w-0 flex-1 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const NUM_CLASS =
  'w-20 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]';

const DAY_MINUTES = 1440;
const DEFAULT_SPAN = 60;

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
      max={DAY_MINUTES}
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
 * Generic add/edit surface for one coded-time-span lane (people or equipment).
 * Items are the same `LaneItem` primitive; the lane differs only by `catalog`.
 * "Add" appends a snapped span seeded from the first catalog row; per-row edits
 * (code select, name, start/end snap-on-blur, remove) re-emit the whole list.
 */
export function LaneEditors({ title, items, catalog, onChange, idPrefix }: LaneEditorsProps) {
  const update = (index: number, patch: Partial<LaneItem>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const add = () => {
    const first = catalog[0];
    if (!first) return;
    const lastEnd = items.length ? Math.max(...items.map((it) => it.endMin)) : 0;
    const startMin = Math.min(DAY_MINUTES, snapTo5(lastEnd));
    const endMin = Math.min(DAY_MINUTES, snapTo5(startMin + DEFAULT_SPAN));
    const item: LaneItem = {
      id: `${idPrefix}-${items.length + 1}`,
      code: first.code,
      label: first.label,
      startMin,
      endMin,
    };
    onChange([...items, item]);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="eyebrow">{title}</div>
        <button type="button" onClick={add} className={BTN_CLASS} aria-label={`Add ${title}`}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add
        </button>
      </div>

      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div
            key={it.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.012] px-2.5 py-1.5"
          >
            <select
              aria-label={`Code for ${title} ${i + 1}`}
              value={it.code}
              onChange={(e) => update(i, { code: e.target.value })}
              className={SELECT_CLASS}
            >
              {catalog.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {`${opt.code} — ${opt.label}`}
                </option>
              ))}
            </select>

            <input
              aria-label={`Name for ${title} ${i + 1}`}
              type="text"
              value={it.label}
              placeholder="Name"
              onChange={(e) => update(i, { label: e.target.value })}
              className={TEXT_CLASS}
            />

            <label className="flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/60">
              <span className="font-mono">Start</span>
              <MinuteInput
                label="Start (min)"
                value={it.startMin}
                onCommit={(snapped) => update(i, { startMin: snapped })}
              />
            </label>

            <label className="flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/60">
              <span className="font-mono">End</span>
              <MinuteInput
                label="End (min)"
                value={it.endMin}
                onCommit={(snapped) => update(i, { endMin: snapped })}
              />
            </label>

            <button
              type="button"
              aria-label={`Remove ${title} ${i + 1}`}
              onClick={() => remove(i)}
              className="ml-auto rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground/50">
            None yet — add one from the catalog.
          </p>
        )}
      </div>
    </div>
  );
}
