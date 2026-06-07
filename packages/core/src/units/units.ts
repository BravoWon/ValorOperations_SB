export type LengthUnit = 'mm' | 'cm' | 'in' | 'ft' | 'yd' | 'm';
export const LENGTH_UNITS: LengthUnit[] = ['mm', 'cm', 'in', 'ft', 'yd', 'm'];

// Canonical = meters. Convert via canonical to keep one source of truth.
const METERS_PER: Record<LengthUnit, number> = { mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048, yd: 0.9144, m: 1 };

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (!Number.isFinite(value)) return value;
  if (from === to) return value;
  return (value * METERS_PER[from]) / METERS_PER[to];
}

export function formatLength(value: number, unit: LengthUnit, decimals = 2): string {
  if (!Number.isFinite(value)) return `— ${unit}`;
  return `${value.toFixed(decimals)} ${unit}`;
}
