'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { TemplateStageDef } from '@valor/core';
import { nextSuffixId } from '@/lib/next-id';

export interface StageDefTableProps {
  stages: TemplateStageDef[];
  bankCodes: string[];
  templateId: string;
  onChange: (next: TemplateStageDef[]) => void;
}

const CELL =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const BANK_LIST_ID = 'stage-bank-codes';

export function StageDefTable({ stages, bankCodes, templateId, onChange }: StageDefTableProps) {
  const patch = (i: number, next: Partial<TemplateStageDef>) => {
    const row = stages[i];
    if (!row) return;
    const copy = stages.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };
  const removeAt = (i: number) => onChange(stages.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...stages,
      { id: nextSuffixId('tsd-new-', stages.map((s) => s.id)), templateId, name: '', stageType: '', defaultSortOrder: (stages.length + 1) * 10 },
    ]);

  return (
    <div className="space-y-3">
      <datalist id={BANK_LIST_ID}>
        {bankCodes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Stage', 'Type', 'Order', 'Default code'].map((h) => (
                <th key={h} className="pb-1.5 pr-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">{h}</th>
              ))}
              <th className="w-8 pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i} data-testid="stage-def-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2"><input aria-label="Stage name" type="text" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Stage type" type="text" value={s.stageType} onChange={(e) => patch(i, { stageType: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Sort order" type="number" step="1" value={Number.isFinite(s.defaultSortOrder) ? String(s.defaultSortOrder) : ''} onChange={(e) => patch(i, { defaultSortOrder: e.target.value === '' ? 0 : Number(e.target.value) })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Default code" type="text" list={BANK_LIST_ID} value={s.defaultCode ?? ''} onChange={(e) => patch(i, { defaultCode: e.target.value.toUpperCase() })} className={CELL} /></td>
                <td className="py-1">
                  <button type="button" aria-label={`Remove stage ${s.name || i + 1}`} onClick={() => removeAt(i)} className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]">
        <Plus className="h-3 w-3" strokeWidth={2.5} /> Add stage
      </button>
    </div>
  );
}
