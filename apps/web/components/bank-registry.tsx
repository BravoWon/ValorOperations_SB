'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { BANK_CATEGORIES, type BankCode } from '@valor/core';

export interface BankRegistryProps {
  codes: BankCode[];
  onChange: (next: BankCode[]) => void;
}

const CELL_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const SEARCH_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 py-1.5 pl-8 pr-2.5 font-mono text-sm text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

const CATEGORY_LIST_ID = 'bank-categories';

const COLUMNS: { key: string; label: string }[] = [
  { key: 'code', label: 'Code' },
  { key: 'label', label: 'Label' },
  { key: 'category', label: 'Category' },
  { key: 'npt', label: 'NPT' },
  { key: 'billable', label: 'Billable' },
];

export function BankRegistry({ codes, onChange }: BankRegistryProps) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return codes.map((c, i) => ({ c, i }));
    return codes
      .map((c, i) => ({ c, i }))
      .filter(
        ({ c }) =>
          c.code.toLowerCase().includes(q) ||
          c.label.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q),
      );
  }, [codes, q]);

  const patch = (i: number, next: Partial<BankCode>) => {
    const row = codes[i];
    if (!row) return;
    const copy = codes.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };

  const removeAt = (i: number) => onChange(codes.filter((_, j) => j !== i));

  const addCode = () =>
    onChange([...codes, { code: '', label: '', category: BANK_CATEGORIES[0] ?? '', npt: false, billable: false }]);

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
          aria-label="Search codes"
          placeholder="Search codes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={SEARCH_INPUT_CLASS}
        />
      </div>

      <datalist id={CATEGORY_LIST_ID}>
        {BANK_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

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
              <tr key={c.code || i} data-testid="bank-code-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2">
                  <input
                    aria-label="Code"
                    type="text"
                    value={c.code}
                    onChange={(e) => patch(i, { code: e.target.value.toUpperCase() })}
                    className={CELL_INPUT_CLASS}
                    maxLength={12}
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
                    aria-label="Category"
                    type="text"
                    list={CATEGORY_LIST_ID}
                    value={c.category}
                    onChange={(e) => patch(i, { category: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2 text-center">
                  <input
                    aria-label="NPT"
                    type="checkbox"
                    checked={c.npt}
                    onChange={(e) => patch(i, { npt: e.target.checked })}
                    className="h-3.5 w-3.5 accent-gold"
                  />
                </td>
                <td className="py-1 pr-2 text-center">
                  <input
                    aria-label="Billable"
                    type="checkbox"
                    checked={c.billable}
                    onChange={(e) => patch(i, { billable: e.target.checked })}
                    className="h-3.5 w-3.5 accent-gold"
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    aria-label={`Remove ${c.code || 'code'}`}
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
        onClick={addCode}
        className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
        Add code
      </button>
    </div>
  );
}
