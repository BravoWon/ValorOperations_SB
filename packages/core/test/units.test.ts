import { describe, it, expect } from 'vitest';
import { convertLength, formatLength, LENGTH_UNITS } from '../src/units/units';

describe('convertLength', () => {
  it('round-trips in↔mm', () => { expect(convertLength(1, 'in', 'mm')).toBeCloseTo(25.4, 6); });
  it('converts ft→m', () => { expect(convertLength(10, 'ft', 'm')).toBeCloseTo(3.048, 6); });
  it('identity', () => { expect(convertLength(5.5, 'in', 'in')).toBe(5.5); });
  it('passes non-finite through', () => { expect(Number.isNaN(convertLength(NaN, 'ft', 'm'))).toBe(true); });
  it('exposes all six length units', () => { expect(LENGTH_UNITS).toEqual(['mm','cm','in','ft','yd','m']); });
});
describe('formatLength', () => {
  it('formats with unit + decimals', () => { expect(formatLength(3.048, 'm', 3)).toBe('3.048 m'); });
});
