import type { AfeLine, AfeSummary, AfeCategoryRoll } from './types';
export { AFE_CATEGORIES } from './types';

export const DEFAULT_AFE: AfeLine[] = [
  { id: 'afe-1', code: '100', description: 'Rig Day Rate',        category: 'Drilling',    budget: 450000, actual: 470000 },
  { id: 'afe-2', code: '200', description: 'Drilling Fluids',     category: 'Mud',         budget: 120000, actual: 115000 },
  { id: 'afe-3', code: '300', description: 'Cementing',           category: 'Cement',      budget: 85000,  actual: 90000 },
  { id: 'afe-4', code: '400', description: 'Directional Services',category: 'Directional', budget: 160000, actual: 158000 },
  { id: 'afe-5', code: '500', description: 'Casing & Tubulars',   category: 'Tubulars',    budget: 220000, actual: 210000 },
  { id: 'afe-6', code: '600', description: 'Wireline / Logging',  category: 'Wireline',    budget: 60000,  actual: 0 },
  { id: 'afe-7', code: '700', description: 'Bits',                category: 'Drilling',    budget: 45000,  actual: 52000 },
  { id: 'afe-8', code: '800', description: 'Logistics & Trucking',category: 'Logistics',   budget: 35000,  actual: 38000 },
];

export function blankAfeLine(seq: number): AfeLine {
  return { id: `afe-${seq}`, code: '', description: '', category: 'Other', budget: 0, actual: 0 };
}

export function summarizeAfe(lines: AfeLine[]): AfeSummary {
  const num = (n: number) => (Number.isFinite(n) ? n : 0);
  const byCat = new Map<string, AfeCategoryRoll>();
  let totalBudget = 0, totalActual = 0;
  for (const l of lines) {
    const b = num(l.budget), a = num(l.actual);
    totalBudget += b; totalActual += a;
    const r = byCat.get(l.category) ?? { category: l.category, budget: 0, actual: 0, variance: 0 };
    r.budget += b; r.actual += a; r.variance = r.budget - r.actual;
    byCat.set(l.category, r);
  }
  return { totalBudget, totalActual, variance: totalBudget - totalActual, byCategory: [...byCat.values()].sort((x, y) => y.budget - x.budget) };
}
