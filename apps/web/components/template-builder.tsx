'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TemplateBundle, JobTemplate, JobType, TemplateStageDef, TemplateFieldDef } from '@valor/core';
import { StageDefTable } from '@/components/stage-def-table';
import { FieldDefTable } from '@/components/field-def-table';
import { nextSuffixId } from '@/lib/next-id';

export interface TemplateBuilderProps {
  bundles: TemplateBundle[];
  bankCodes: string[];
  onChange: (next: TemplateBundle[]) => void;
}

const CELL =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const JOB_TYPES: JobType[] = ['drilling', 'completion', 'workover', 'other'];

export function TemplateBuilder({ bundles, bankCodes, onChange }: TemplateBuilderProps) {
  const [selected, setSelected] = useState(0);
  const idx = Math.min(selected, Math.max(0, bundles.length - 1));
  const bundle = bundles[idx];

  const patchBundle = (i: number, next: Partial<TemplateBundle>) => {
    const row = bundles[i];
    if (!row) return;
    const copy = bundles.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };
  const patchTemplate = (i: number, next: Partial<JobTemplate>) => {
    const row = bundles[i];
    if (!row) return;
    patchBundle(i, { template: { ...row.template, ...next } });
  };

  const addTemplate = () => {
    const n = bundles.length + 1;
    const id = nextSuffixId('tmpl-new-', bundles.map((b) => b.template.id));
    const fresh: TemplateBundle = {
      template: { id, orgId: bundle?.template.orgId ?? '', name: `New Template ${n}`, jobType: 'drilling', version: 1, isActive: true },
      stageDefs: [],
      fieldDefs: [],
    };
    onChange([...bundles, fresh]);
    setSelected(bundles.length);
  };
  const removeTemplate = (i: number) => {
    onChange(bundles.filter((_, j) => j !== i));
    setSelected(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {bundles.map((b, i) => (
          <button
            key={b.template.id}
            type="button"
            onClick={() => setSelected(i)}
            className={`rounded-md border px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors ${
              i === idx ? 'border-gold/50 bg-gold/[0.12] text-gold-light' : 'border-white/[0.08] text-muted-foreground/70 hover:text-cream'
            }`}
          >
            {b.template.name || '(unnamed)'}
          </button>
        ))}
        <button type="button" onClick={addTemplate} className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]">
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Add template
        </button>
      </div>

      {bundle && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
              Name
              <input aria-label="Template name" type="text" value={bundle.template.name} onChange={(e) => patchTemplate(idx, { name: e.target.value })} className={`${CELL} w-64`} />
            </label>
            <label className="flex flex-col gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
              Job type
              <select aria-label="Job type" value={bundle.template.jobType} onChange={(e) => patchTemplate(idx, { jobType: e.target.value as JobType })} className={CELL}>
                {JOB_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
              <input aria-label="Template active" type="checkbox" checked={bundle.template.isActive} onChange={(e) => patchTemplate(idx, { isActive: e.target.checked })} className="h-3.5 w-3.5 accent-gold" />
              Active
            </label>
            <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/50">v{bundle.template.version}</span>
            <button type="button" aria-label="Remove template" onClick={() => removeTemplate(idx)} className="ml-auto flex items-center gap-1 rounded-md border border-white/[0.08] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red">
              <Trash2 className="h-3 w-3" strokeWidth={2} /> Remove template
            </button>
          </div>

          <div>
            <h3 className="mb-2 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light/80">Stages</h3>
            <StageDefTable
              stages={bundle.stageDefs}
              bankCodes={bankCodes}
              templateId={bundle.template.id}
              onChange={(next: TemplateStageDef[]) => patchBundle(idx, { stageDefs: next })}
            />
          </div>

          <div>
            <h3 className="mb-2 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light/80">Field definitions</h3>
            <FieldDefTable
              fields={bundle.fieldDefs}
              templateId={bundle.template.id}
              onChange={(next: TemplateFieldDef[]) => patchBundle(idx, { fieldDefs: next })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
