import { describe, it, expect } from 'vitest';
import { isValidSnapshot, summarizeSnapshot } from '../src/local-db/types';

describe('local-db snapshot', () => {
  it('summarizes counts across collections', () => {
    const info = summarizeSnapshot({ version: 1, collections: { channels: [{} as never, {} as never], vendors: [] } });
    expect(info.find((c) => c.key === 'channels')?.count).toBe(2);
    expect(info.find((c) => c.key === 'vendors')?.count).toBe(0);
    expect(info.find((c) => c.key === 'rigDays')?.count).toBe(0); // absent → 0
  });
  it('validates a snapshot', () => {
    expect(isValidSnapshot({ version: 1, collections: {} })).toBe(true);
    expect(isValidSnapshot({ version: 2, collections: {} })).toBe(false);
    expect(isValidSnapshot({ collections: {} })).toBe(false);
    expect(isValidSnapshot(null)).toBe(false);
    expect(isValidSnapshot({ version: 1, collections: [] })).toBe(false); // array is not a collection map
  });
});
