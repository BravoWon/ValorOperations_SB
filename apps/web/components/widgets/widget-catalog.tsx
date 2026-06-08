'use client';

import { useEffect, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong animate-fade-up w-full max-w-lg overflow-hidden rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-catalog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head flex items-center justify-between px-5 py-4">
          <div>
            <div className="eyebrow mb-1">Catalog</div>
            <h2 id="widget-catalog-title" className="font-display text-lg font-medium text-cream">
              Add widget
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-white/[0.06] hover:text-cream"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-5 overflow-auto p-5">
          {ORDER.map((cat) => {
            const items = all.filter((w) => w.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="eyebrow mb-2.5">{CATEGORY_LABELS[cat]}</div>
                <div className="space-y-2">
                  {items.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      aria-label={`Add ${w.title}`}
                      onClick={() => onAdd(w.id)}
                      className="group flex w-full items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.015] p-3 text-left transition-all hover:border-gold/40 hover:bg-gold/[0.05]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-cream">{w.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {w.description}
                        </span>
                      </span>
                      <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gold/30 bg-gold/10 text-gold transition-colors group-hover:border-gold/50 group-hover:bg-gold/20">
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
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
