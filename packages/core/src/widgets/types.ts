export type WidgetCategory = 'compute' | 'data' | 'report' | 'embed';

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
}

export interface WidgetInstance {
  instanceId: string;
  widgetId: string;
  layout: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  ownerId: string;
  widgets: WidgetInstance[];
}

export function isValidDashboardLayout(value: unknown): value is DashboardLayout {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  if (typeof d.ownerId !== 'string' || typeof d.id !== 'string' || !Array.isArray(d.widgets)) return false;
  return (d.widgets as unknown[]).every((w) => {
    if (!w || typeof w !== 'object') return false;
    const i = w as Record<string, unknown>;
    if (typeof i.instanceId !== 'string' || typeof i.widgetId !== 'string') return false;
    const l = i.layout as Record<string, unknown> | null | undefined;
    return !!l && typeof l === 'object'
      && (['x', 'y', 'w', 'h'] as const).every((k) => Number.isFinite((l as Record<string, unknown>)[k]));
  });
}

/** Deterministic first-run layout (12-col grid). instanceIds are fixed for the defaults. */
export function createDefaultDashboard(ownerId: string): DashboardLayout {
  return {
    id: 'default',
    ownerId,
    widgets: [
      { instanceId: 'w-kpi', widgetId: 'kpi-strip', layout: { x: 0, y: 0, w: 12, h: 2 } },
      { instanceId: 'w-jobs', widgetId: 'active-jobs', layout: { x: 0, y: 2, w: 8, h: 8 } },
      { instanceId: 'w-asset', widgetId: 'asset-tree', layout: { x: 8, y: 2, w: 4, h: 8 } },
      { instanceId: 'w-hydraulics', widgetId: 'hydraulics', layout: { x: 0, y: 10, w: 8, h: 12 } },
    ],
  };
}
