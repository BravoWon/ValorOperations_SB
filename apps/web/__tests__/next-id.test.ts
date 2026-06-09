import { describe, it, expect } from 'vitest';
import { nextSuffixId } from '@/lib/next-id';

describe('nextSuffixId', () => {
  it('returns prefix+1 for an empty list', () => {
    expect(nextSuffixId('tsd-new-', [])).toBe('tsd-new-1');
  });
  it('exceeds the max existing suffix (collision-safe after a middle remove)', () => {
    expect(nextSuffixId('tmpl-new-', ['tmpl-new-1', 'tmpl-new-3'])).toBe('tmpl-new-4');
  });
  it('ignores ids that do not match the prefix pattern', () => {
    expect(nextSuffixId('tsd-new-', ['tsd-1', 'tsd-2'])).toBe('tsd-new-1');
  });
});
