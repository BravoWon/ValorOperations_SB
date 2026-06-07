import { describe, it, expect } from 'vitest';
import '@/widgets'; // registers the six real widgets (side effects)
import { listWidgets, getWidget } from '@/lib/widgets/registry';
import { createDefaultDashboard, DEMO_USER_ID, type WidgetCategory } from '@valor/core';

const VALID_CATEGORIES: WidgetCategory[] = ['compute', 'data', 'report', 'embed'];

describe('widget registry integrity (real widgets)', () => {
  it('registers exactly the six core widgets', () => {
    expect(listWidgets().map((d) => d.id).sort()).toEqual(
      ['active-jobs', 'asset-tree', 'daily-report', 'hydraulics', 'kpi-strip', 'power-bi'].sort(),
    );
  });

  it('every widget has a unique id, a valid category, and a positive defaultSize', () => {
    const defs = listWidgets();
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of defs) {
      expect(VALID_CATEGORIES).toContain(d.category);
      expect(d.defaultSize.w).toBeGreaterThan(0);
      expect(d.defaultSize.h).toBeGreaterThan(0);
    }
  });

  it('every default-dashboard widgetId resolves in the registry (no Unknown widget)', () => {
    for (const w of createDefaultDashboard(DEMO_USER_ID).widgets) {
      expect(getWidget(w.widgetId)).toBeDefined();
    }
  });
});
