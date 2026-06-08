'use client';

import { Plus, Trash2 } from 'lucide-react';
import { AFE_CATEGORIES, blankAfeLine, type AfeLine } from '@valor/core';

export interface AfeTableProps {
  lines: AfeLine[];
  onChange: (next: AfeLine[]) => void;
}

const CELL_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

const COLUMNS: { key: string; label: string }[] = [
  { key: 'code', label: 'Code' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'budget', label: 'Budget' },
  { key: 'actual', label: 'Actual' },
];

/** Largest `afe-N` suffix in the list, so an added row never collides. */
function maxSeq(lines: AfeLine[]): number {
  let max = 0;
  for (const l of lines) {
    const m = /^afe-(\d+)$/.exec(l.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Number-cell value: '' when not finite so empties read as blanks, not 0. */
function numDisplay(v: number | undefined): string {
  return Number.isFinite(v) ? String(v) : '';
}

export function AfeTable({ lines, onChange }: AfeTableProps) {
  // Patch the row at index `i` and bubble the whole next array up.
  const patch = (i: number, next: Partial<AfeLine>) => {
    const row = lines[i];
    if (!row) return;
    const copy = lines.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };

  const patchNum = (i: number, key: 'budget' | 'actual', raw: string) => {
    const n = Number(raw);
    patch(i, { [key]: raw === '' || Number.isNaN(n) ? 0 : n } as Partial<AfeLine>);
  };

  const removeAt = (i: number) => onChange(lines.filter((_, j) => j !== i));

  const addLine = () => onChange([...lines, blankAfeLine(maxSeq(lines) + 1)]);

  return (
    <div className="space-y-4">
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
            {lines.map((l, i) => (
              <tr key={l.id} data-testid="afe-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2">
                  <input
                    aria-label="Code"
                    type="text"
                    value={l.code}
                    onChange={(e) => patch(i, { code: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Description"
                    type="text"
                    value={l.description}
                    onChange={(e) => patch(i, { description: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    aria-label="AFE category"
                    value={l.category}
                    onChange={(e) => patch(i, { category: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  >
                    {AFE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Budget"
                    type="number"
                    step="any"
                    value={numDisplay(l.budget)}
                    onChange={(e) => patchNum(i, 'budget', e.target.value)}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Actual"
                    type="number"
                    step="any"
                    value={numDisplay(l.actual)}
                    onChange={(e) => patchNum(i, 'actual', e.target.value)}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    aria-label={`Remove line ${l.code || l.id}`}
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
        onClick={addLine}
        className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
        Add line
      </button>
    </div>
  );
}
