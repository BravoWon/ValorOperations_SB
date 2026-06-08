'use client';

import type { ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';

export function WidgetCard({
  title,
  icon,
  onRemove,
  children,
}: {
  title: string;
  icon?: ReactNode;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="glass group/widget flex h-full flex-col overflow-hidden rounded-lg transition-colors duration-200 hover:border-gold/25">
      <div className="widget-drag-handle card-head flex cursor-grab items-center gap-2 bg-white/[0.02] px-3 py-2 active:cursor-grabbing">
        <GripVertical
          className="h-3.5 w-3.5 text-muted-foreground/30 transition-colors group-hover/widget:text-gold/50"
          strokeWidth={2}
          aria-hidden="true"
        />
        {icon}
        <span className="truncate font-display text-sm font-medium text-cream">{title}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={`Remove ${title}`}
            className="ml-auto rounded-md p-1 text-muted-foreground/70 opacity-0 transition-all hover:bg-red/10 hover:text-red focus-visible:opacity-100 group-hover/widget:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3.5">{children}</div>
    </div>
  );
}
