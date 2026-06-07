import { describe, it, expect } from 'vitest';
import { createDefaultDashboard } from '../src/widgets/types';

describe('createDefaultDashboard', () => {
  it('builds a default dashboard for an owner with the four core widgets', () => {
    const d = createDefaultDashboard('user-1');
    expect(d.ownerId).toBe('user-1');
    expect(d.widgets.map((w) => w.widgetId)).toEqual([
      'kpi-strip', 'active-jobs', 'asset-tree', 'hydraulics',
    ]);
  });

  it('gives every widget a unique instanceId and a layout', () => {
    const d = createDefaultDashboard('user-1');
    const ids = d.widgets.map((w) => w.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of d.widgets) {
      expect(w.layout).toMatchObject({
        x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number),
      });
    }
  });
});
