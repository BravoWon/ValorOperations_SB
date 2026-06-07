'use client';

import { useEffect, useMemo } from 'react';
import type { WidgetCategory } from '@valor/core';
import { listWidgets } from '@/lib/widgets/registry';

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  compute: 'Calculators',
  data: 'Data',
  report: 'Reports',
  embed: 'Embeds',
};
const ORDER: WidgetCategory[] = ['compute', 'data', 'report', 'embed'];

export function WidgetCatalog({
  onAdd,
  onClose,
}: {
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}) {
  const all = useMemo(() => listWidgets(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-strong w-full max-w-lg rounded-xl p-5" role="dialog" aria-modal="true" aria-labelledby="widget-catalog-title" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="widget-catalog-title" className="font-display text-lg text-cream">Add widget</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground">✕</button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-auto">
          {ORDER.map((cat) => {
            const items = all.filter((w) => w.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="eyebrow mb-2">{CATEGORY_LABELS[cat]}</div>
                <div className="space-y-2">
                  {items.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      aria-label={`Add ${w.title}`}
                      onClick={() => onAdd(w.id)}
                      className="flex w-full items-center gap-3 rounded-md border border-border/40 p-3 text-left hover:border-gold/40"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-cream">{w.title}</span>
                        <span className="block text-xs text-muted-foreground">{w.description}</span>
                      </span>
                      <span className="ml-auto text-sm text-gold">Add</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
