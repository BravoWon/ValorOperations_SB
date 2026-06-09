'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { BankCode } from '@valor/core';

export interface BankSearchPaletteProps {
  open: boolean;
  onClose: () => void;
  codes: BankCode[];
  onSelect?: (code: BankCode) => void;
}

/** Global "search the Bank" command palette (Cmd/Ctrl-K). Reference picker; `onSelect` optional. */
export function BankSearchPalette({ open, onClose, codes, onSelect }: BankSearchPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Coerce defensively — persisted Bank JSON could be hand-edited/malformed.
    const norm = (v: unknown) => String(v ?? '').toLowerCase();
    const categories = [...new Set(codes.map((c) => c.category))];
    const matches = (b: BankCode) =>
      !q || norm(b.code).includes(q) || norm(b.label).includes(q) || norm(b.category).includes(q);
    return categories
      .map((category) => ({ category, items: codes.filter((b) => b.category === category && matches(b)) }))
      .filter((g) => g.items.length > 0);
  }, [codes, query]);

  if (!open) return null;

  const pick = (b: BankCode) => {
    onSelect?.(b);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onClick={onClose}
      data-testid="bank-search-palette"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bank search palette"
        className="glass-strong w-full max-w-lg overflow-hidden rounded-lg border border-gold/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <label className="relative block border-b border-white/[0.08]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            aria-label="Search the Bank"
            placeholder="Search the Bank — code, label, or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent py-3 pl-10 pr-3 font-mono text-sm text-cream outline-none placeholder:text-muted-foreground/50"
          />
        </label>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3">
          {groups.map((g) => (
            <div key={g.category}>
              <div className="eyebrow mb-1.5">{g.category}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => pick(b)}
                    className={
                      b.npt
                        ? 'rounded-md border border-red/30 bg-red/[0.06] px-2 py-1 font-mono text-[0.6875rem] text-red transition-colors hover:bg-red/[0.12]'
                        : 'rounded-md border border-gold/25 bg-gold/[0.05] px-2 py-1 font-mono text-[0.6875rem] text-gold-light transition-colors hover:bg-gold/[0.12]'
                    }
                  >
                    {`${b.code} — ${b.label}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="font-mono text-xs text-muted-foreground/50">
              {query.trim() ? `No codes match "${query}".` : 'The Bank is empty.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
