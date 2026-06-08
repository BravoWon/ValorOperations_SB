import { describe, it, expect } from 'vitest';
import { snapTo5, DAY_MINUTES } from '../src/rig-day/time-accounting';

describe('snapTo5', () => {
  it('rounds to nearest 5', () => { expect(snapTo5(72)).toBe(70); expect(snapTo5(73)).toBe(75); });
  it('clamps to [0,1440]', () => { expect(snapTo5(-10)).toBe(0); expect(snapTo5(99999)).toBe(DAY_MINUTES); });
  it('non-finite → 0', () => { expect(snapTo5(NaN)).toBe(0); });
});
