import { describe, it, expect } from 'vitest';
import { createDefaultDashboard } from '../src/widgets/types';
import { MockRepository } from '../src/mock-repository';

function fakeLocalStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

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

describe('dashboard persistence', () => {
  it('returns the default dashboard when none is stored', async () => {
    const d = await new MockRepository().getDashboard('user-1');
    expect(d.widgets).toHaveLength(4);
  });

  it('round-trips a saved dashboard (in-memory fallback)', async () => {
    const repo = new MockRepository();
    const layout = { id: 'd', ownerId: 'user-1', widgets: [] };
    await repo.saveDashboard(layout);
    expect((await repo.getDashboard('user-1')).widgets).toEqual([]);
  });

  it('persists via localStorage when present', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage();
    try {
      const repo = new MockRepository();
      await repo.saveDashboard({ id: 'd', ownerId: 'u2', widgets: [] });
      const raw = globalThis.localStorage.getItem('valor:dashboard:u2');
      expect(raw).toContain('"ownerId":"u2"');
      expect((await new MockRepository().getDashboard('u2')).widgets).toEqual([]);
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });

  it('returns the default when localStorage holds corrupt JSON', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage();
    try {
      localStorage.setItem('valor:dashboard:u3', '{not valid json');
      expect((await new MockRepository().getDashboard('u3')).widgets).toHaveLength(4);
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });

  it('returns the default when localStorage has no entry for the owner', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage();
    try {
      expect((await new MockRepository().getDashboard('u4')).widgets).toHaveLength(4);
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });

  it('in-memory save stores a clone (caller mutation does not leak)', async () => {
    const repo = new MockRepository();
    const layout = { id: 'd', ownerId: 'u5', widgets: [] };
    await repo.saveDashboard(layout);
    (layout.widgets as unknown[]).push({});
    expect((await repo.getDashboard('u5')).widgets).toEqual([]);
  });
});
