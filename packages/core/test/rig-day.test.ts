import { describe, it, expect } from 'vitest';
import { snapTo5, deriveTimeAccounting } from '../src/rig-day/time-accounting';
import { DAY_MINUTES, type TimeBlock } from '../src/rig-day/types';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';

describe('snapTo5', () => {
  it('rounds to nearest 5', () => { expect(snapTo5(72)).toBe(70); expect(snapTo5(73)).toBe(75); });
  it('clamps to [0,1440]', () => { expect(snapTo5(-10)).toBe(0); expect(snapTo5(99999)).toBe(DAY_MINUTES); });
  it('non-finite → 0', () => { expect(snapTo5(NaN)).toBe(0); });
});

const B = (code: string, startMin: number, endMin: number): TimeBlock => ({ id: `${code}-${startMin}`, code, startMin, endMin });

describe('deriveTimeAccounting', () => {
  it('sums minutes by code', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 60), B('DRL', 120, 180), B('TIH', 60, 120)]);
    expect(a.totalLoggedMin).toBe(180);
    expect(a.byCode.find((c) => c.code === 'DRL')?.minutes).toBe(120);
  });
  it('splits NPT from productive', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 60), B('RIGREP', 60, 120)]); // RIGREP is npt:true
    expect(a.nptMin).toBe(60);
    expect(a.productiveMin).toBe(60);
  });
  it('reports unaccounted gaps within [0, now]', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 60), B('TIH', 120, 180)]);
    expect(a.unaccountedGaps).toEqual([{ startMin: 60, endMin: 120 }]);
  });
  it('warns on overlap', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 90), B('TIH', 60, 120)]);
    expect(a.warnings.some((w) => /overlap/i.test(w))).toBe(true);
  });
  it('warns on unknown code', () => {
    const a = deriveTimeAccounting([B('ZZZ', 0, 30)]);
    expect(a.warnings.some((w) => /bank/i.test(w))).toBe(true);
  });
  it('clamps an out-of-range nowMin to [0, DAY_MINUTES]', () => {
    const blocks = [B('DRL', 0, 60)];
    const hi = deriveTimeAccounting(blocks, 999999);
    expect(hi.unaccountedGaps.every((g) => g.endMin <= DAY_MINUTES)).toBe(true);
    const lo = deriveTimeAccounting(blocks, -100);
    expect(lo.unaccountedGaps).toEqual([]);
  });
});

it('default rig day has blocks incl. an NPT one', () => {
  expect(DEFAULT_RIG_DAY.blocks.length).toBeGreaterThanOrEqual(5);
  const a = deriveTimeAccounting(DEFAULT_RIG_DAY.blocks);
  expect(a.nptMin).toBeGreaterThan(0);
});

it('seed includes people and equipment lanes', () => {
  expect((DEFAULT_RIG_DAY.people ?? []).length).toBeGreaterThanOrEqual(2);
  expect((DEFAULT_RIG_DAY.equipment ?? []).length).toBeGreaterThanOrEqual(2);
});

import { PARTY_ROLES, EQUIPMENT_CATEGORIES, findPartyRole, deriveProgress } from '../src/rig-day/lanes';

describe('rig-day lanes', () => {
  it('catalogs have unique codes', () => {
    for (const cat of [PARTY_ROLES, EQUIPMENT_CATEGORIES]) {
      const codes = cat.map((c) => c.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
  it('finds a party role', () => { expect(findPartyRole(PARTY_ROLES[0]!.code)?.label).toBeTruthy(); });
  it('derives a time-ordered depth curve from block depths', () => {
    const pts = deriveProgress([
      { id: 'a', code: 'DRL', startMin: 0, endMin: 60, depthStartFt: 100, depthEndFt: 200 },
      { id: 'b', code: 'DRL', startMin: 60, endMin: 120, depthStartFt: 200, depthEndFt: 350 },
    ]);
    expect(pts[0]).toEqual({ atMin: 0, depthFt: 100 });
    expect(pts[pts.length - 1]).toEqual({ atMin: 120, depthFt: 350 });
    expect(pts.every((p, i) => i === 0 || p.atMin >= pts[i - 1]!.atMin)).toBe(true);
  });
  it('ignores blocks without depths', () => {
    expect(deriveProgress([{ id: 'x', code: 'CIRC', startMin: 0, endMin: 30 }])).toEqual([]);
  });
  it('returns points sorted by time even when blocks overlap', () => {
    const pts = deriveProgress([
      { id: 'a', code: 'DRL', startMin: 0, endMin: 90, depthStartFt: 100, depthEndFt: 300 },
      { id: 'b', code: 'DRL', startMin: 60, endMin: 120, depthStartFt: 250, depthEndFt: 400 },
    ]);
    expect(pts.every((p, i) => i === 0 || p.atMin >= pts[i - 1]!.atMin)).toBe(true);
  });
});
