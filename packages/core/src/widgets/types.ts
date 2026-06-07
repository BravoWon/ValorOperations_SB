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
