'use client';

import { useState } from 'react';
import {
  computeHydraulics,
  HYDRAULICS_FIELDS,
  HYDRAULICS_OUTPUTS,
  type HydraulicsInputs,
} from '@valor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DEFAULTS: HydraulicsInputs = HYDRAULICS_FIELDS.reduce((acc, f) => {
  acc[f.key] = f.default;
  return acc;
}, {} as HydraulicsInputs);

const GROUPS = ['Geometry', 'Depth', 'Fluid', 'Pump'] as const;

export function HydraulicsPanel() {
  const [inputs, setInputs] = useState<HydraulicsInputs>(DEFAULTS);
  const result = computeHydraulics(inputs);

  const setField = (key: keyof HydraulicsInputs, raw: string) => {
    const n = Number(raw);
    setInputs((p) => ({ ...p, [key]: raw === '' || Number.isNaN(n) ? 0 : n }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="eyebrow mb-2">{group}</div>
              <div className="grid grid-cols-2 gap-3">
                {HYDRAULICS_FIELDS.filter((f) => f.group === group).map((f) => (
                  <label key={f.key} htmlFor={f.key} className="text-sm">
                    <span className="block text-muted-foreground">
                      {f.label} <span className="font-mono text-xs text-muted-foreground/70">({f.unit})</span>
                    </span>
                    <input
                      id={f.key}
                      type="number"
                      value={Number.isFinite(inputs[f.key]) ? inputs[f.key] : ''}
                      min={f.min}
                      max={f.max}
                      step="any"
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-sm text-cream outline-none focus:border-gold/50"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            {HYDRAULICS_OUTPUTS.map((o) => (
              <div key={o.key} className="flex items-baseline justify-between border-b border-border/40 pb-1.5">
                <dt className="text-sm text-muted-foreground">{o.label}</dt>
                <dd className="font-mono text-sm">
                  <span className="text-gold">{Number.isFinite(result[o.key]) ? result[o.key].toFixed(o.decimals) : '—'}</span>{' '}
                  <span className="text-xs text-muted-foreground/70">{o.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          {result.warnings.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-red-400">
              {result.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground/60">Pump model: triplex, single-acting.</p>
        </CardContent>
      </Card>
    </div>
  );
}
