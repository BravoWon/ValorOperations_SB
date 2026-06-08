'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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
    <div className="stagger grid gap-6 lg:grid-cols-2">
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
                      className="mt-1 w-full rounded-md border border-white/[0.08] bg-background/40 px-2.5 py-1.5 font-mono text-sm text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60"
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
          <dl className="space-y-0">
            {HYDRAULICS_OUTPUTS.map((o) => (
              <div
                key={o.key}
                className="flex items-baseline justify-between border-b border-white/[0.05] py-2 transition-colors last:border-0 hover:bg-gold/[0.03]"
              >
                <dt className="text-sm text-muted-foreground">{o.label}</dt>
                <dd className="data text-sm tabular-nums">
                  <span className="text-gold-light">
                    {Number.isFinite(result[o.key]) ? (
                      result[o.key].toFixed(o.decimals)
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </span>{' '}
                  <span className="text-xs text-muted-foreground/70">{o.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          {result.warnings.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {result.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground/50">
            Pump model: triplex, single-acting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
