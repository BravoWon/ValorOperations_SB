'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  CHANNEL_SOURCES,
  blankChannel,
  type ChannelDef,
  type ChannelDataType,
  type ChannelSource,
} from '@valor/core';

export interface ChannelRegistryProps {
  channels: ChannelDef[];
  onChange: (next: ChannelDef[]) => void;
}

const CELL_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const SEARCH_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 py-1.5 pl-8 pr-2.5 font-mono text-sm text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

const DATA_TYPES: ChannelDataType[] = ['number', 'text'];

const COLUMNS: { key: string; label: string }[] = [
  { key: 'channelId', label: 'Channel' },
  { key: 'mnemonic', label: 'Mnemonic' },
  { key: 'label', label: 'Label' },
  { key: 'unit', label: 'Unit' },
  { key: 'dataType', label: 'Type' },
  { key: 'dp', label: 'DP' },
  { key: 'source', label: 'Source' },
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'alarmLo', label: 'Alarm Lo' },
  { key: 'alarmHi', label: 'Alarm Hi' },
  { key: 'enabled', label: 'On' },
];

/** Largest `ch-N` suffix in the list, so an added row never collides. */
function maxSeq(channels: ChannelDef[]): number {
  let max = 0;
  for (const c of channels) {
    const m = /^ch-(\d+)$/.exec(c.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Number-cell value: '' when not finite so empties read as blanks, not 0. */
function numDisplay(v: number | undefined): string {
  return Number.isFinite(v) ? String(v) : '';
}

export function ChannelRegistry({ channels, onChange }: ChannelRegistryProps) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return channels.map((c, i) => ({ c, i }));
    return channels
      .map((c, i) => ({ c, i }))
      .filter(
        ({ c }) =>
          c.mnemonic.toLowerCase().includes(q) ||
          c.label.toLowerCase().includes(q) ||
          c.channelId.toLowerCase().includes(q),
      );
  }, [channels, q]);

  // Patch the row at canonical index `i` and bubble the whole next array up.
  const patch = (i: number, next: Partial<ChannelDef>) => {
    const row = channels[i];
    if (!row) return;
    const copy = channels.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };

  const removeAt = (i: number) => onChange(channels.filter((_, j) => j !== i));

  const addChannel = () => onChange([...channels, blankChannel(maxSeq(channels) + 1)]);

  // Optional alarm number: '' clears the field; a finite value sets it.
  const patchOptionalNum = (i: number, key: 'alarmLo' | 'alarmHi', raw: string) => {
    const row = channels[i];
    if (!row) return;
    const copy = channels.slice();
    if (raw === '') {
      const { [key]: _omit, ...rest } = row;
      copy[i] = rest;
    } else {
      const n = Number(raw);
      copy[i] = { ...row, [key]: Number.isNaN(n) ? 0 : n };
    }
    onChange(copy);
  };

  const patchNum = (i: number, key: 'dp' | 'min' | 'max', raw: string) => {
    const n = Number(raw);
    patch(i, { [key]: raw === '' || Number.isNaN(n) ? 0 : n } as Partial<ChannelDef>);
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50"
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          type="text"
          aria-label="Search channels"
          placeholder="Search channels…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={SEARCH_INPUT_CLASS}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="pb-1.5 pr-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70"
                >
                  {col.label}
                </th>
              ))}
              <th className="w-8 pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ c, i }) => (
              <tr key={c.id} data-testid="channel-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2">
                  <input
                    aria-label="Channel"
                    type="text"
                    value={c.channelId}
                    onChange={(e) => patch(i, { channelId: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Mnemonic"
                    type="text"
                    value={c.mnemonic}
                    onChange={(e) => patch(i, { mnemonic: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Label"
                    type="text"
                    value={c.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Unit"
                    type="text"
                    value={c.unit}
                    onChange={(e) => patch(i, { unit: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    aria-label="Data type"
                    value={c.dataType}
                    onChange={(e) => patch(i, { dataType: e.target.value as ChannelDataType })}
                    className={CELL_INPUT_CLASS}
                  >
                    {DATA_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Decimal places"
                    type="number"
                    step="1"
                    value={numDisplay(c.dp)}
                    onChange={(e) => patchNum(i, 'dp', e.target.value)}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    aria-label="Source"
                    value={c.source}
                    onChange={(e) => patch(i, { source: e.target.value as ChannelSource })}
                    className={CELL_INPUT_CLASS}
                  >
                    {CHANNEL_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Min"
                    type="number"
                    step="any"
                    value={numDisplay(c.min)}
                    onChange={(e) => patchNum(i, 'min', e.target.value)}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Max"
                    type="number"
                    step="any"
                    value={numDisplay(c.max)}
                    onChange={(e) => patchNum(i, 'max', e.target.value)}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Alarm low"
                    type="number"
                    step="any"
                    value={numDisplay(c.alarmLo)}
                    onChange={(e) => patchOptionalNum(i, 'alarmLo', e.target.value)}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Alarm high"
                    type="number"
                    step="any"
                    value={numDisplay(c.alarmHi)}
                    onChange={(e) => patchOptionalNum(i, 'alarmHi', e.target.value)}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2 text-center">
                  <input
                    aria-label="Enabled"
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => patch(i, { enabled: e.target.checked })}
                    className="h-3.5 w-3.5 accent-gold"
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    aria-label={`Remove channel ${c.mnemonic || c.id}`}
                    onClick={() => removeAt(i)}
                    className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addChannel}
        className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
        Add channel
      </button>
    </div>
  );
}
