import Link from 'next/link';
import { AlertTriangle, Users, Wrench, Clock } from 'lucide-react';
import type { TicketSummary } from '@valor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface TicketCardProps {
  summary: TicketSummary;
}

const CATEGORY_ACCENT: Record<string, string> = {
  'Make Hole': 'border-gold/30 bg-gold/[0.08] text-gold-light',
  'Pipe Movement': 'border-cyan/30 bg-cyan/[0.08] text-cyan',
  'Casing/Cement': 'border-white/15 bg-white/[0.06] text-cream',
  'Pressure/BOP': 'border-cyan/30 bg-cyan/[0.08] text-cyan',
  'Evaluation': 'border-gold/30 bg-gold/[0.08] text-gold-light',
  'Trouble (NPT)': 'border-red/30 bg-red/[0.08] text-red',
  'Service': 'border-white/15 bg-white/[0.06] text-cream',
};

function fmtHm(atMin: number): string {
  const h = Math.floor(atMin / 60);
  const m = atMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TicketCard({ summary }: TicketCardProps) {
  const accent = (summary.category && CATEGORY_ACCENT[summary.category]) || 'border-gold/30 bg-gold/[0.08] text-gold-light';
  return (
    <Card data-testid="ticket-card" className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-sm">{summary.label || '(unnamed)'}</CardTitle>
        {summary.code && (
          <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[0.625rem] ${accent}`}>
            {summary.code}{summary.bankLabel ? ` · ${summary.bankLabel}` : ''}
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 text-xs text-muted-foreground">
        {summary.status && (
          <span className="w-fit rounded-md border border-white/[0.08] bg-background/40 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-cream/80">
            {summary.status}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[0.6875rem]">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" />{summary.parties}</span>
          <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" aria-hidden="true" />{summary.equipment}</span>
          <span>{summary.bha} BHA</span>
        </div>
        <div className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem]">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {summary.timelineCount} events
          {summary.latestActivity && (
            <span className="text-muted-foreground/70">
              · latest {summary.latestActivity.code ?? '—'} @ {fmtHm(summary.latestActivity.atMin)}
            </span>
          )}
        </div>
        {summary.warningCount > 0 && (
          <span aria-label={`${summary.warningCount} warning(s)`} className="inline-flex w-fit items-center gap-1 rounded-md border border-red/20 bg-red/[0.06] px-2 py-0.5 text-[0.6875rem] text-red">
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {summary.warningCount}
          </span>
        )}
        <Link
          href={`/tickets/${summary.id}`}
          className="mt-auto inline-flex w-fit items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
        >
          View timeline
        </Link>
      </CardContent>
    </Card>
  );
}
