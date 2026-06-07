import type { WellSetup, WellboreModel } from './types';
import { findBankCode } from './bank';

export function projectWellbore(setup: WellSetup): WellboreModel {
  const warnings: string[] = [];
  const code = findBankCode(setup.header.jobCode);
  if (!code) warnings.push(`Job code "${setup.header.jobCode}" is not in the Bank.`);

  const casings = [...setup.casings].sort((a, b) => b.odIn - a.odIn);
  const holes = [...setup.holes].sort((a, b) => a.topFt - b.topFt);
  const formations = [...setup.formations].sort((a, b) => a.topFt - b.topFt);

  const depths = [
    ...casings.map((c) => c.shoeMdFt),
    ...holes.map((h) => h.bottomFt),
    ...formations.map((f) => f.bottomFt),
  ].filter((d) => Number.isFinite(d));
  const totalDepthFt = depths.length ? Math.max(...depths) : 0;

  const holeBottom = holes.length ? Math.max(...holes.map((h) => h.bottomFt)) : totalDepthFt;
  for (const c of casings) {
    if (Number.isFinite(c.shoeMdFt) && holeBottom > 0 && c.shoeMdFt > holeBottom) {
      warnings.push(`${c.role} shoe (${c.shoeMdFt} ft) is below the deepest hole section (${holeBottom} ft).`);
    }
    if (c.idIn >= c.odIn) warnings.push(`${c.role} ID must be smaller than OD.`);
  }

  return {
    header: { ...setup.header, codeLabel: code?.label ?? setup.header.jobCode },
    totalDepthFt, casings, holes, formations, warnings,
  };
}
