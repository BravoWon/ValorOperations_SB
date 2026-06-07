import { describe, it, expect } from 'vitest';
import { createDefaultDashboard, isValidDashboardLayout } from '../src/widgets/types';
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

describe('isValidDashboardLayout + persistence hardening', () => {
  it('accepts a well-formed layout and rejects malformed ones', () => {
    expect(isValidDashboardLayout({ id: 'd', ownerId: 'u', widgets: [] })).toBe(true);
    expect(isValidDashboardLayout({ id: 'd', ownerId: 'u', widgets: [{ instanceId: 'a', widgetId: 'b', layout: { x: 0, y: 0, w: 1, h: 1 } }] })).toBe(true);
    expect(isValidDashboardLayout(null)).toBe(false);
    expect(isValidDashboardLayout({ ownerId: 'u', widgets: [] })).toBe(false); // missing id
    expect(isValidDashboardLayout({ id: 'd', ownerId: 'u', widgets: [{ instanceId: 'a', widgetId: 'b', layout: { x: 0, y: null, w: 1, h: 1 } }] })).toBe(false); // null y
    expect(isValidDashboardLayout({ id: 'd', ownerId: 'u', widgets: [{ instanceId: 'a', widgetId: 'b' }] })).toBe(false); // missing layout
  });

  it('getDashboard falls back to the default when a stored layout has a null y', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage();
    try {
      globalThis.localStorage.setItem(
        'valor:dashboard:u6',
        JSON.stringify({ id: 'd', ownerId: 'u6', widgets: [{ instanceId: 'a', widgetId: 'kpi-strip', layout: { x: 0, y: null, w: 12, h: 2 } }] }),
      );
      expect((await new MockRepository().getDashboard('u6')).widgets).toHaveLength(4);
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });

  it('getDashboard falls back to the default when a stored widget is missing its layout', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage();
    try {
      globalThis.localStorage.setItem(
        'valor:dashboard:u7',
        JSON.stringify({ id: 'd', ownerId: 'u7', widgets: [{ instanceId: 'a', widgetId: 'kpi-strip' }] }),
      );
      expect((await new MockRepository().getDashboard('u7')).widgets).toHaveLength(4);
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });

  it('getDashboard ignores a stored layout whose ownerId does not match', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage();
    try {
      globalThis.localStorage.setItem(
        'valor:dashboard:u8',
        JSON.stringify({ id: 'd', ownerId: 'someone-else', widgets: [] }),
      );
      expect((await new MockRepository().getDashboard('u8')).widgets).toHaveLength(4);
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });
});
