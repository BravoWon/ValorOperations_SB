'use client';

import { useEffect, useState } from 'react';
import { ResponsiveGridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { Plus } from 'lucide-react';
import { createDefaultDashboard, DEMO_USER_ID, type DashboardLayout, type WidgetInstance } from '@valor/core';
import { getRepo } from '@/lib/repo';
import { getWidget } from '@/lib/widgets/registry';
import { WidgetCard } from '@/components/widgets/widget-card';
import { WidgetCatalog } from '@/components/widgets/widget-catalog';

let counter = 0;
function newInstanceId(): string {
  counter += 1;
  return `w-${Date.now()}-${counter}`;
}

export function Dashboard() {
  const repo = getRepo();
  const [dash, setDash] = useState<DashboardLayout | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const { containerRef, width, mounted } = useContainerWidth({ initialWidth: 1280 });

  useEffect(() => {
    repo
      .getDashboard(DEMO_USER_ID)
      .then(setDash)
      .catch(() => setDash(createDefaultDashboard(DEMO_USER_ID)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dash) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>;

  const persist = (next: DashboardLayout) => {
    setDash(next);
    void repo.saveDashboard(next);
  };

  const onLayoutChange = (current: Layout /* , allLayouts */) => {
    const byId = new Map(current.map((l) => [l.i, l]));
    let changed = false;
    const widgets = dash.widgets.map((w) => {
      const l = byId.get(w.instanceId);
      if (!l) return w;
      if (l.x === w.layout.x && l.y === w.layout.y && l.w === w.layout.w && l.h === w.layout.h) return w;
      changed = true;
      return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
    });
    // Multi-breakpoint (md/sm) persistence deferred; v1 persists the primary layout only.
    if (changed) persist({ ...dash, widgets });
  };

  const addWidget = (widgetId: string) => {
    const def = getWidget(widgetId)?.def;
    if (!def) return;
    const bottomY = dash.widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0);
    const inst: WidgetInstance = {
      instanceId: newInstanceId(),
      widgetId,
      layout: { x: 0, y: bottomY, w: def.defaultSize.w, h: def.defaultSize.h },
    };
    persist({ ...dash, widgets: [...dash.widgets, inst] });
    setCatalogOpen(false);
  };

  const removeWidget = (instanceId: string) =>
    persist({ ...dash, widgets: dash.widgets.filter((w) => w.instanceId !== instanceId) });

  const lgLayout: Layout = dash.widgets.map((w) => ({
    i: w.instanceId,
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: getWidget(w.widgetId)?.def.minSize?.w,
    minH: getWidget(w.widgetId)?.def.minSize?.h,
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Dashboard</h1>
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold-light"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add widget
        </button>
      </div>

      <div ref={containerRef}>
        <ResponsiveGridLayout
          className="layout"
          width={mounted ? width : 1280}
          layouts={{ lg: lgLayout }}
          breakpoints={{ lg: 1024, md: 768, sm: 0 }}
          cols={{ lg: 12, md: 8, sm: 1 }}
          rowHeight={36}
          dragConfig={{ handle: '.widget-drag-handle', bounded: true, enabled: true, threshold: 3 }}
          onLayoutChange={(current) => onLayoutChange(current)}
        >
          {dash.widgets.map((w) => {
            const entry = getWidget(w.widgetId);
            return (
              <div key={w.instanceId}>
                <WidgetCard title={entry?.def.title ?? w.widgetId} onRemove={() => removeWidget(w.instanceId)}>
                  {entry ? (
                    <entry.Component config={w.config} surface="card" />
                  ) : (
                    <div className="text-xs text-red">Unknown widget: {w.widgetId}</div>
                  )}
                </WidgetCard>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>

      {catalogOpen && <WidgetCatalog onAdd={addWidget} onClose={() => setCatalogOpen(false)} />}
    </div>
  );
}
