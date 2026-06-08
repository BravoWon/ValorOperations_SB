import type { WellSetup, WellboreModel } from './types';
import { findBankCode } from './bank';

export function projectWellbore(setup: WellSetup): WellboreModel {
  const warnings: string[] = [];
  const code = findBankCode(setup.header.jobCode);
  if (!code) warnings.push(`Job code "${setup.header.jobCode}" is not in the Bank.`);

  // Drop fully-blank rows (e.g. an unfilled "Add" row) so they don't render as
  // degenerate zero-depth strings/markers.
  const casings = [...setup.casings]
    .filter((c) => c.role.trim() !== '' || c.odIn > 0 || c.idIn > 0 || c.shoeMdFt > 0)
    .sort((a, b) => b.odIn - a.odIn);
  const holes = [...setup.holes]
    .filter((h) => h.name.trim() !== '' || h.bitDiaIn > 0 || h.bottomFt > 0)
    .sort((a, b) => a.topFt - b.topFt);
  const formations = [...setup.formations]
    .filter((f) => f.name.trim() !== '' || f.topFt > 0 || f.bottomFt > 0)
    .sort((a, b) => a.topFt - b.topFt);

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
