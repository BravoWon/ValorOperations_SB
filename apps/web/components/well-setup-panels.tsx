'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  HEADER_FIELDS,
  CASING_COLUMNS,
  HOLE_COLUMNS,
  FORMATION_COLUMNS,
  BANK_SEED,
  convertLength,
  type WellSetup,
  type WellSetupHeader,
  type CasingRow,
  type HoleRow,
  type FormationRow,
  type ColumnSpec,
  type HeaderFieldSpec,
  type LengthUnit,
} from '@valor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface WellSetupPanelsProps {
  setup: WellSetup;
  onChange: (next: WellSetup) => void;
  depthUnit: LengthUnit;
  diaUnit: LengthUnit;
}

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-white/[0.08] bg-background/40 px-2.5 py-1.5 font-mono text-sm text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const CELL_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

const HEADER_GROUPS = ['Identity', 'Section', 'Schedule'] as const;

// Diameter-quantity columns flip with diaUnit; everything else (depths) with depthUnit.
const DIAMETER_KEYS = new Set(['odIn', 'idIn', 'bitDiaIn']);

function rowUnitFor(key: string, depthUnit: LengthUnit, diaUnit: LengthUnit): LengthUnit {
  return DIAMETER_KEYS.has(key) ? diaUnit : depthUnit;
}

/** Display a canonical (in/ft) value in the chosen unit; '' when not finite. */
function toDisplay(canonical: number, displayUnit: LengthUnit): string {
  if (!Number.isFinite(canonical)) return '';
  const v = convertLength(canonical, displayUnit === 'mm' || displayUnit === 'cm' || displayUnit === 'in' ? 'in' : 'ft', displayUnit);
  // round to a stable precision for editing
  return String(Number(v.toFixed(4)));
}

export function WellSetupPanels({ setup, onChange, depthUnit, diaUnit }: WellSetupPanelsProps) {
  // ---- Header ----------------------------------------------------------
  const setHeader = <K extends keyof WellSetupHeader>(key: K, value: WellSetupHeader[K]) => {
    onChange({ ...setup, header: { ...setup.header, [key]: value } });
  };

  const setHeaderNumber = (field: HeaderFieldSpec, raw: string) => {
    // Header number fields use the diameter unit (the only one is diameterIn).
    const displayUnit = diaUnit;
    const n = Number(raw);
    const canonical = raw === '' || Number.isNaN(n) ? NaN : convertLength(n, displayUnit, 'in');
    setHeader(field.key, (Number.isNaN(canonical) ? 0 : canonical) as WellSetupHeader[typeof field.key]);
  };

  const renderHeaderField = (f: HeaderFieldSpec) => {
    const value = setup.header[f.key];
    const unitSuffix = f.unitQuantity === 'length' ? diaUnit : undefined;

    if (f.kind === 'code') {
      return (
        <select
          id={f.key}
          value={String(value)}
          onChange={(e) => setHeader(f.key, e.target.value as WellSetupHeader[typeof f.key])}
          className={INPUT_CLASS}
        >
          {BANK_SEED.map((b) => (
            <option key={b.code} value={b.code}>
              {`${b.code} — ${b.label}`}
            </option>
          ))}
        </select>
      );
    }
    if (f.kind === 'enum') {
      return (
        <select
          id={f.key}
          value={String(value)}
          onChange={(e) => setHeader(f.key, e.target.value as WellSetupHeader[typeof f.key])}
          className={INPUT_CLASS}
        >
          {(f.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (f.kind === 'datetime') {
      return (
        <input
          id={f.key}
          type="datetime-local"
          value={String(value ?? '')}
          onChange={(e) => setHeader(f.key, e.target.value as WellSetupHeader[typeof f.key])}
          className={INPUT_CLASS}
        />
      );
    }
    if (f.kind === 'number') {
      return (
        <input
          id={f.key}
          type="number"
          step="any"
          value={toDisplay(value as number, diaUnit)}
          onChange={(e) => setHeaderNumber(f, e.target.value)}
          className={INPUT_CLASS}
        />
      );
    }
    // text
    return (
      <input
        id={f.key}
        type="text"
        value={String(value ?? '')}
        onChange={(e) => setHeader(f.key, e.target.value as WellSetupHeader[typeof f.key])}
        className={INPUT_CLASS}
      />
    );
  };

  // ---- Repeatable tables ----------------------------------------------
  function renderCellInput<T extends object>(
    col: ColumnSpec,
    row: T,
    onRowChange: (next: T) => void,
    idPrefix: string,
  ) {
    const id = `${idPrefix}-${col.key}`;
    const cell = (row as Record<string, unknown>)[col.key];
    if (col.kind === 'number') {
      const unit = rowUnitFor(col.key, depthUnit, diaUnit);
      return (
        <input
          id={id}
          aria-label={col.label}
          type="number"
          step="any"
          value={toDisplay(cell as number, unit)}
          onChange={(e) => {
            const n = Number(e.target.value);
            const canonicalUnit: LengthUnit = DIAMETER_KEYS.has(col.key) ? 'in' : 'ft';
            const canonical =
              e.target.value === '' || Number.isNaN(n) ? 0 : convertLength(n, unit, canonicalUnit);
            onRowChange({ ...row, [col.key]: canonical });
          }}
          className={CELL_INPUT_CLASS}
        />
      );
    }
    return (
      <input
        id={id}
        aria-label={col.label}
        type="text"
        value={String(cell ?? '')}
        onChange={(e) => onRowChange({ ...row, [col.key]: e.target.value })}
        className={CELL_INPUT_CLASS}
      />
    );
  }

  function RepeatableTable<T extends object>({
    title,
    columns,
    rows,
    onRowsChange,
    blankRow,
    idPrefix,
  }: {
    title: string;
    columns: ColumnSpec[];
    rows: T[];
    onRowsChange: (next: T[]) => void;
    blankRow: () => T;
    idPrefix: string;
  }) {
    const unitFor = (col: ColumnSpec) =>
      col.unitQuantity === 'length' ? rowUnitFor(col.key, depthUnit, diaUnit) : undefined;

    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="eyebrow">{title}</div>
          <button
            type="button"
            onClick={() => onRowsChange([...rows, blankRow()])}
            className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
            Add
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="pb-1.5 pr-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70"
                  >
                    {col.label}
                    {unitFor(col) ? (
                      <span className="ml-1 text-muted-foreground/40">({unitFor(col)})</span>
                    ) : null}
                  </th>
                ))}
                <th className="w-8 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-white/[0.05]">
                  {columns.map((col) => (
                    <td key={col.key} className="py-1 pr-2">
                      {renderCellInput(col, row, (next) => {
                        const copy = [...rows];
                        copy[i] = next;
                        onRowsChange(copy);
                      }, `${idPrefix}-${i}`)}
                    </td>
                  ))}
                  <td className="py-1">
                    <button
                      type="button"
                      aria-label={`Remove ${title} row ${i + 1}`}
                      onClick={() => onRowsChange(rows.filter((_, j) => j !== i))}
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
      </div>
    );
  }

  const blankCasing = (): CasingRow => ({
    role: '', odIn: 0, idIn: 0, weightPpf: 0, grade: '', connection: '', shoeMdFt: 0, shoeTvdFt: 0, tocFt: 0,
  });
  const blankHole = (): HoleRow => ({ name: '', bitDiaIn: 0, topFt: 0, bottomFt: 0 });
  const blankFormation = (): FormationRow => ({ name: '', topFt: 0, bottomFt: 0 });

  return (
    <div className="stagger space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Section / Job Header</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {HEADER_GROUPS.map((group) => (
            <div key={group}>
              <div className="eyebrow mb-2">{group}</div>
              <div className="grid grid-cols-2 gap-3">
                {HEADER_FIELDS.filter((f) => f.group === group).map((f) => (
                  <label key={String(f.key)} htmlFor={String(f.key)} className="text-sm">
                    <span className="block text-muted-foreground">
                      {f.label}
                      {f.unitQuantity === 'length' ? (
                        <span className="ml-1 font-mono text-xs text-muted-foreground/70">({diaUnit})</span>
                      ) : null}
                    </span>
                    {renderHeaderField(f)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strings &amp; Geometry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RepeatableTable<CasingRow>
            title="Casing / Liner Strings"
            columns={CASING_COLUMNS}
            rows={setup.casings}
            onRowsChange={(casings) => onChange({ ...setup, casings })}
            blankRow={blankCasing}
            idPrefix="casing"
          />
          <RepeatableTable<HoleRow>
            title="Hole Sections"
            columns={HOLE_COLUMNS}
            rows={setup.holes}
            onRowsChange={(holes) => onChange({ ...setup, holes })}
            blankRow={blankHole}
            idPrefix="hole"
          />
          <RepeatableTable<FormationRow>
            title="Formation Tops"
            columns={FORMATION_COLUMNS}
            rows={setup.formations}
            onRowsChange={(formations) => onChange({ ...setup, formations })}
            blankRow={blankFormation}
            idPrefix="formation"
          />
        </CardContent>
      </Card>
    </div>
  );
}
