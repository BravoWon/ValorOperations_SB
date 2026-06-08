import { describe, it, expect } from 'vitest';
import { snapTo5, DAY_MINUTES } from '../src/rig-day/time-accounting';
import { deriveTimeAccounting } from '../src/rig-day/time-accounting';
import type { TimeBlock } from '../src/rig-day/types';
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
});

it('default rig day has blocks incl. an NPT one', () => {
  expect(DEFAULT_RIG_DAY.blocks.length).toBeGreaterThanOrEqual(5);
  const a = deriveTimeAccounting(DEFAULT_RIG_DAY.blocks);
  expect(a.nptMin).toBeGreaterThan(0);
});
