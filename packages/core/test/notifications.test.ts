import { describe, it, expect } from 'vitest';
import { deriveNotifications, DEFAULT_NOTIFICATION_RULES } from '../src/notifications/notifications';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';
import type { RigDay } from '../src/rig-day/types';

describe('deriveNotifications', () => {
  it('flags NPT over threshold as critical', () => {
    // DEFAULT_RIG_DAY has a 90-min RIGREP block (> 60 default).
    const n = deriveNotifications(DEFAULT_RIG_DAY);
    expect(n.some((x) => x.category === 'NPT' && x.severity === 'critical')).toBe(true);
  });
  it('no NPT notification under threshold', () => {
    const calm: RigDay = { id: 'd', label: 'D', blocks: [{ id: 'b', code: 'DRL', startMin: 0, endMin: 120 }] };
    expect(deriveNotifications(calm).some((x) => x.category === 'NPT')).toBe(false);
  });
  it('flags a long unaccounted gap as warn', () => {
    const gappy: RigDay = { id: 'd', label: 'D', blocks: [
      { id: 'a', code: 'DRL', startMin: 0, endMin: 60 },
      { id: 'b', code: 'TIH', startMin: 240, endMin: 300 },
    ] };
    expect(deriveNotifications(gappy).some((x) => x.category === 'gap' && x.severity === 'warn')).toBe(true);
  });
  it('flags a QC-flagged block', () => {
    const flagged: RigDay = { id: 'd', label: 'D', blocks: [
      { id: 'a', code: 'DRL', startMin: 0, endMin: 60, qc: { status: 'flagged', note: 'washout' } },
    ] };
    const qc = deriveNotifications(flagged).find((x) => x.category === 'qc');
    expect(qc?.detail).toContain('washout');
  });
  it('empty day → []', () => {
    expect(deriveNotifications({ id: 'd', label: 'D', blocks: [] })).toEqual([]);
  });
  it('sorts critical before warn', () => {
    const n = deriveNotifications(DEFAULT_RIG_DAY);
    const sev = n.map((x) => x.severity);
    const order = { critical: 0, warn: 1, info: 2 } as const;
    expect(sev).toEqual([...sev].sort((a, b) => order[a] - order[b]));
  });
  it('exposes default rules', () => { expect(DEFAULT_NOTIFICATION_RULES.nptThresholdMin).toBeGreaterThan(0); });
});
