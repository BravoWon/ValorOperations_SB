'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

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
    <div className="glass flex h-full flex-col overflow-hidden rounded-xl">
      <div className="widget-drag-handle flex cursor-move items-center gap-2 border-b border-border/40 px-3 py-2">
        {icon}
        <span className="font-display text-sm text-cream">{title}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            className="ml-auto rounded p-1 text-muted-foreground hover:text-red"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
