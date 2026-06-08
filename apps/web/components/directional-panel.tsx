'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  computeSurvey,
  DEFAULT_SURVEY,
  SURVEY_INPUT_COLUMNS,
  SURVEY_OUTPUT_COLUMNS,
  type SurveyStation,
} from '@valor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

const num = (raw: string): number => {
  const n = Number(raw);
  return raw === '' || Number.isNaN(n) ? 0 : n;
};

export function DirectionalPanel() {
  const [stations, setStations] = useState<SurveyStation[]>(DEFAULT_SURVEY);
  const [vsAziRaw, setVsAziRaw] = useState(''); // '' = auto (final closure azimuth)
  const [courseLength, setCourseLength] = useState(100);

  const result = useMemo(() => {
    const vsAzimuth = vsAziRaw.trim() === '' ? undefined : num(vsAziRaw);
    return computeSurvey(stations, { vsAzimuth, courseLength });
  }, [stations, vsAziRaw, courseLength]);

  // The course length picks the unit system you work in (no conversion — survey
  // depths are entered and reported in one system). Derive every displayed unit
  // from it so labels never disagree with the data.
  const lengthUnit = courseLength === 30 ? 'm' : 'ft';
  const dlsUnit = `°/${courseLength}`;
  const displayUnit = (col: { unit: string; unitQuantity?: 'length'; perCourse?: boolean }): string =>
    col.unitQuantity === 'length' ? lengthUnit : col.perCourse ? dlsUnit : col.unit;

  const setCell = (i: number, key: keyof SurveyStation, raw: string) =>
    setStations((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: num(raw) } : s)));

  const addRow = () =>
    setStations((p) => {
      const last = p[p.length - 1];
      return [...p, { md: (last?.md ?? 0) + 500, inc: last?.inc ?? 0, azi: last?.azi ?? 0 }];
    });

  const removeRow = (i: number) => setStations((p) => p.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Survey stations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left">
                  <th className="eyebrow px-2 py-1.5 font-normal">#</th>
                  {SURVEY_INPUT_COLUMNS.map((c) => (
                    <th key={c.key} className="eyebrow px-2 py-1.5 font-normal">
                      {c.label} <span className="text-muted-foreground/60">({displayUnit(c)})</span>
                    </th>
                  ))}
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {stations.map((s, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="px-2 py-1 font-mono text-[0.6875rem] text-muted-foreground/60">{i + 1}</td>
                    {SURVEY_INPUT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-1">
                        <input
                          type="number"
                          aria-label={`${c.label} row ${i + 1}`}
                          value={Number.isFinite(s[c.key]) ? s[c.key] : ''}
                          min={c.min}
                          max={c.max}
                          step="any"
                          onChange={(e) => setCell(i, c.key, e.target.value)}
                          className={INPUT_CLASS}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        aria-label={`Remove station ${i + 1}`}
                        onClick={() => removeRow(i)}
                        disabled={stations.length <= 1}
                        className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-red disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add station
            </button>
            <label className="text-sm">
              <span className="block text-muted-foreground">
                VS azimuth <span className="font-mono text-xs text-muted-foreground/70">(° — blank = auto)</span>
              </span>
              <input
                type="number"
                value={vsAziRaw}
                placeholder="auto"
                step="any"
                onChange={(e) => setVsAziRaw(e.target.value)}
                className="mt-1 w-28 rounded-md border border-white/[0.08] bg-background/40 px-2.5 py-1.5 font-mono text-sm text-cream outline-none focus:border-gold/50 focus:bg-background/60"
              />
            </label>
            <label className="text-sm">
              <span className="block text-muted-foreground">
                Course length <span className="font-mono text-xs text-muted-foreground/70">(ft/m)</span>
              </span>
              <select
                value={courseLength}
                onChange={(e) => setCourseLength(Number(e.target.value))}
                className="mt-1 w-28 rounded-md border border-white/[0.08] bg-background/40 px-2.5 py-1.5 font-mono text-sm text-cream outline-none focus:border-gold/50"
              >
                <option value={100}>100 ft</option>
                <option value={30}>30 m</option>
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'TD (MD)', value: result.summary.totalMd, unit: lengthUnit, d: 0 },
          { label: 'TVD', value: result.summary.totalTvd, unit: lengthUnit, d: 1 },
          { label: 'Closure', value: result.summary.closure, unit: lengthUnit, d: 1 },
          { label: 'Closure azi', value: result.summary.closureAzimuth, unit: '°', d: 1 },
          { label: 'VS', value: result.summary.vs, unit: lengthUnit, d: 1 },
          { label: 'Max DLS', value: result.summary.maxDls, unit: dlsUnit, d: 2 },
        ].map((k) => (
          <div key={k.label} className="rounded-md border border-white/[0.06] bg-background/30 px-3 py-2.5">
            <div className="eyebrow mb-1 truncate">{k.label}</div>
            <div className="font-display text-lg font-medium tracking-tight text-gold-light tabular-nums">
              {k.value.toFixed(k.d)}
              {k.unit && <span className="ml-0.5 text-xs text-muted-foreground/70">{k.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Computed trajectory (minimum curvature)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left">
                  {SURVEY_INPUT_COLUMNS.map((c) => (
                    <th key={c.key} className="eyebrow px-2 py-1.5 font-normal">{c.label}</th>
                  ))}
                  {SURVEY_OUTPUT_COLUMNS.map((c) => (
                    <th key={c.key} className="eyebrow px-2 py-1.5 font-normal">
                      {c.label} <span className="text-muted-foreground/60">{displayUnit(c)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.stations.map((s, i) => (
                  <tr key={i} data-testid="traj-row" className="border-b border-white/[0.04] tabular-nums">
                    {SURVEY_INPUT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-1 font-mono text-xs text-muted-foreground/85">
                        {s[c.key].toFixed(c.decimals)}
                      </td>
                    ))}
                    {SURVEY_OUTPUT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-1 font-mono text-xs text-cream">
                        {s[c.key].toFixed(c.decimals)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
            Method: minimum curvature · tied to surface · VS azimuth {result.summary.vsAzimuth.toFixed(1)}°.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
