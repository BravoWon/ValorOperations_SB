'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { BANK_SEED } from '@valor/core';

export interface BankPaletteProps {
  onAdd: (code: string) => void;
}

/** Distinct categories in BANK_SEED order, for grouping the catalog. */
const CATEGORIES: string[] = [...new Set(BANK_SEED.map((b) => b.category))];

/**
 * Searchable Bank catalog grouped by category. Clicking an entry appends a
 * coded block (the page wires the actual append/snap). NPT codes are tinted red.
 */
export function BankPalette({ onAdd }: BankPaletteProps) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (label: string, code: string) =>
      !q || label.toLowerCase().includes(q) || code.toLowerCase().includes(q);
    return CATEGORIES.map((category) => ({
      category,
      codes: BANK_SEED.filter(
        (b) => b.category === category && matches(b.label, b.code),
      ),
    })).filter((g) => g.codes.length > 0);
  }, [query]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Search the Bank"
          placeholder="Search the Bank…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-white/[0.08] bg-background/40 py-1.5 pl-8 pr-2.5 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60"
        />
      </label>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.category}>
            <div className="eyebrow mb-1.5">{g.category}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.codes.map((b) => (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => onAdd(b.code)}
                  className={
                    b.npt
                      ? 'group flex items-center gap-1 rounded-md border border-red/30 bg-red/[0.06] px-2 py-1 font-mono text-[0.6875rem] text-red transition-colors hover:bg-red/[0.12]'
                      : 'group flex items-center gap-1 rounded-md border border-gold/25 bg-gold/[0.05] px-2 py-1 font-mono text-[0.6875rem] text-gold-light transition-colors hover:bg-gold/[0.12]'
                  }
                >
                  <Plus className="h-3 w-3 opacity-60 group-hover:opacity-100" strokeWidth={2.5} />
                  {`${b.code} — ${b.label}`}
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground/50">No codes match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
