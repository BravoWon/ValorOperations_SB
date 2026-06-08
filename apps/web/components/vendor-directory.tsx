'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  blankVendor,
  type Vendor,
  type VendorStatus,
  type Contact,
} from '@valor/core';

export interface VendorDirectoryProps {
  vendors: Vendor[];
  onChange: (next: Vendor[]) => void;
}

const CELL_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const SEARCH_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 py-1.5 pl-8 pr-2.5 font-mono text-sm text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

const COLUMNS: { key: string; label: string }[] = [
  { key: 'name', label: 'Vendor' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'contactName', label: 'Contact' },
  { key: 'contactRole', label: 'Role' },
  { key: 'contactPhone', label: 'Phone' },
  { key: 'note', label: 'Note' },
];

/** Largest `v-N` suffix in the list, so an added row never collides. */
function maxSeq(vendors: Vendor[]): number {
  let max = 0;
  for (const v of vendors) {
    const m = /^v-(\d+)$/.exec(v.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** The primary contact (`contacts[0]`) or an empty default to render against. */
function primary(v: Vendor): Contact {
  return v.contacts[0] ?? { name: '', role: '', phone: '' };
}

export function VendorDirectory({ vendors, onChange }: VendorDirectoryProps) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return vendors.map((v, i) => ({ v, i }));
    return vendors
      .map((v, i) => ({ v, i }))
      .filter(
        ({ v }) =>
          v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q),
      );
  }, [vendors, q]);

  // Patch the row at canonical index `i` and bubble the whole next array up.
  const patch = (i: number, next: Partial<Vendor>) => {
    const row = vendors[i];
    if (!row) return;
    const copy = vendors.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };

  // Edit the primary contact, creating `contacts[0]` when it is absent.
  const patchContact = (i: number, next: Partial<Contact>) => {
    const row = vendors[i];
    if (!row) return;
    const contacts = row.contacts.slice();
    contacts[0] = { ...primary(row), ...next };
    patch(i, { contacts });
  };

  const removeAt = (i: number) => onChange(vendors.filter((_, j) => j !== i));

  const addVendor = () => onChange([...vendors, blankVendor(maxSeq(vendors) + 1)]);

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
          aria-label="Search vendors"
          placeholder="Search vendors…"
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
            {visible.map(({ v, i }) => {
              const c = primary(v);
              return (
                <tr key={v.id} data-testid="vendor-row" className="border-t border-white/[0.05]">
                  <td className="py-1 pr-2">
                    <input
                      aria-label="Vendor name"
                      type="text"
                      value={v.name}
                      onChange={(e) => patch(i, { name: e.target.value })}
                      className={CELL_INPUT_CLASS}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      aria-label="Vendor category"
                      value={v.category}
                      onChange={(e) => patch(i, { category: e.target.value })}
                      className={CELL_INPUT_CLASS}
                    >
                      {VENDOR_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      aria-label="Vendor status"
                      value={v.status}
                      onChange={(e) => patch(i, { status: e.target.value as VendorStatus })}
                      className={CELL_INPUT_CLASS}
                    >
                      {VENDOR_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label="Contact name"
                      type="text"
                      value={c.name}
                      onChange={(e) => patchContact(i, { name: e.target.value })}
                      className={CELL_INPUT_CLASS}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label="Contact role"
                      type="text"
                      value={c.role}
                      onChange={(e) => patchContact(i, { role: e.target.value })}
                      className={CELL_INPUT_CLASS}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label="Contact phone"
                      type="text"
                      value={c.phone ?? ''}
                      onChange={(e) => patchContact(i, { phone: e.target.value })}
                      className={CELL_INPUT_CLASS}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label="Vendor note"
                      type="text"
                      value={v.note ?? ''}
                      onChange={(e) => patch(i, { note: e.target.value })}
                      className={CELL_INPUT_CLASS}
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      aria-label={`Remove vendor ${v.name || v.id}`}
                      onClick={() => removeAt(i)}
                      className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addVendor}
        className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
        Add vendor
      </button>
    </div>
  );
}
