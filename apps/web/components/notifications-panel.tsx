'use client';

import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import type { Notification, NotificationSeverity } from '@valor/core';

export interface NotificationsPanelProps {
  notifications: Notification[];
}

// Severity → Valor brand tokens (critical = red, warn = gold/amber, info = muted).
const SEV_STYLE: Record<
  NotificationSeverity,
  { row: string; chip: string; dot: string; icon: typeof AlertTriangle }
> = {
  critical: {
    row: 'border-red/25 bg-red/[0.06]',
    chip: 'border-red/40 bg-red/10 text-red',
    dot: 'bg-red',
    icon: AlertOctagon,
  },
  warn: {
    row: 'border-gold/25 bg-gold/[0.05]',
    chip: 'border-gold/40 bg-gold/15 text-gold-light',
    dot: 'bg-gold',
    icon: AlertTriangle,
  },
  info: {
    row: 'border-white/10 bg-white/[0.04]',
    chip: 'border-white/15 bg-white/[0.06] text-muted-foreground',
    dot: 'bg-muted-foreground/60',
    icon: Info,
  },
};

const SEV_LABEL: Record<NotificationSeverity, string> = {
  critical: 'critical',
  warn: 'warn',
  info: 'info',
};
const SEV_HEADER_ORDER: NotificationSeverity[] = ['critical', 'warn', 'info'];

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  if (notifications.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground/60">All clear — no exceptions.</p>
    );
  }

  // Header: count by severity (only severities present).
  const counts = notifications.reduce<Record<NotificationSeverity, number>>(
    (acc, n) => {
      acc[n.severity] += 1;
      return acc;
    },
    { critical: 0, warn: 0, info: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SEV_HEADER_ORDER.filter((s) => counts[s] > 0).map((s) => {
          const style = SEV_STYLE[s];
          return (
            <span
              key={s}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wider ${style.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
              {`${counts[s]} ${SEV_LABEL[s]}`}
            </span>
          );
        })}
      </div>

      <ul className="space-y-1.5">
        {notifications.map((n) => {
          const style = SEV_STYLE[n.severity];
          const Icon = style.icon;
          return (
            <li
              key={n.id}
              data-testid="notification"
              data-severity={n.severity}
              className={`flex items-start gap-2.5 rounded-md border px-3 py-2 ${style.row}`}
            >
              <Icon
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  n.severity === 'critical'
                    ? 'text-red'
                    : n.severity === 'warn'
                      ? 'text-gold-light'
                      : 'text-muted-foreground/70'
                }`}
                strokeWidth={2}
                aria-hidden="true"
              />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`inline-flex items-center rounded-sm border px-1.5 py-0 font-mono text-[0.625rem] font-medium uppercase tracking-wider ${style.chip}`}
                  >
                    {n.category}
                  </span>
                  <span className="text-xs font-medium text-cream/90">{n.title}</span>
                </div>
                <p className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground/70">
                  {n.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
