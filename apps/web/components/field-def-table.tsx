'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { TemplateFieldDef, FieldScope, FieldDataType } from '@valor/core';
import { nextSuffixId } from '@/lib/next-id';

export interface FieldDefTableProps {
  fields: TemplateFieldDef[];
  templateId: string;
  onChange: (next: TemplateFieldDef[]) => void;
}

const CELL =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const SCOPES: FieldScope[] = ['job', 'stage'];
const TYPES: FieldDataType[] = ['number', 'text', 'bool', 'date', 'enum'];

function numDisplay(v: number | undefined): string {
  return Number.isFinite(v) ? String(v) : '';
}

export function FieldDefTable({ fields, templateId, onChange }: FieldDefTableProps) {
  const patch = (i: number, next: Partial<TemplateFieldDef>) => {
    const row = fields[i];
    if (!row) return;
    const copy = fields.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };
  const patchOptionalNum = (i: number, key: 'minValue' | 'maxValue', raw: string) => {
    const row = fields[i];
    if (!row) return;
    const copy = fields.slice();
    if (raw === '') { const { [key]: _omit, ...rest } = row; copy[i] = rest as TemplateFieldDef; }
    else copy[i] = { ...row, [key]: Number(raw) };
    onChange(copy);
  };
  const removeAt = (i: number) => onChange(fields.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...fields,
      { id: nextSuffixId('tfd-new-', fields.map((f) => f.id)), templateId, scope: 'job', key: '', label: '', dataType: 'number', required: false, sortOrder: fields.length + 1 },
    ]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Scope', 'Key', 'Label', 'Type', 'Unit', 'Min', 'Max', 'Req', 'Enum options'].map((h) => (
                <th key={h} className="pb-1.5 pr-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">{h}</th>
              ))}
              <th className="w-8 pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} data-testid="field-def-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2">
                  <select aria-label="Field scope" value={f.scope} onChange={(e) => patch(i, { scope: e.target.value as FieldScope })} className={CELL}>
                    {SCOPES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </td>
                <td className="py-1 pr-2"><input aria-label="Field key" type="text" value={f.key} onChange={(e) => patch(i, { key: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Field label" type="text" value={f.label} onChange={(e) => patch(i, { label: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2">
                  <select aria-label="Field type" value={f.dataType} onChange={(e) => patch(i, { dataType: e.target.value as FieldDataType })} className={CELL}>
                    {TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </td>
                <td className="py-1 pr-2"><input aria-label="Field unit" type="text" value={f.unit ?? ''} onChange={(e) => patch(i, { unit: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Field min" type="number" step="any" value={numDisplay(f.minValue)} onChange={(e) => patchOptionalNum(i, 'minValue', e.target.value)} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Field max" type="number" step="any" value={numDisplay(f.maxValue)} onChange={(e) => patchOptionalNum(i, 'maxValue', e.target.value)} className={CELL} /></td>
                <td className="py-1 pr-2 text-center"><input aria-label="Field required" type="checkbox" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} className="h-3.5 w-3.5 accent-gold" /></td>
                <td className="py-1 pr-2"><input aria-label="Field enum options" type="text" value={(f.enumOptions ?? []).join(', ')} onChange={(e) => patch(i, { enumOptions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className={CELL} /></td>
                <td className="py-1">
                  <button type="button" aria-label={`Remove field ${f.key || i + 1}`} onClick={() => removeAt(i)} className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]">
        <Plus className="h-3 w-3" strokeWidth={2.5} /> Add field
      </button>
    </div>
  );
}
