import { AlertTriangle, Flag } from 'lucide-react';
import type { MorningReportSection } from '@valor/core';

export interface MorningReportViewProps {
  sections: MorningReportSection[];
}

function fmtHm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const KIND_LABEL: Record<'note' | 'hse' | 'milestone', string> = {
  note: 'Note',
  hse: 'HSE',
  milestone: 'Milestone',
};

/** Print-clean morning report: one block per section. Solid fills; no glassmorphism. */
export function MorningReportView({ sections }: MorningReportViewProps) {
  return (
    <div className="space-y-8">
      {sections.map((s) => (
        <section
          key={s.ticketId}
          data-testid="report-section"
          className="rounded-lg border border-gold/20 bg-background/40 p-5 print:break-inside-avoid print:border-black/20 print:bg-white"
        >
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.08] pb-2 print:border-black/10">
            <h2 className="font-display text-lg text-cream print:text-black">{s.sectionLabel}</h2>
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              {s.code}{s.bankLabel ? ` · ${s.bankLabel}` : ''}{s.status ? ` · ${s.status}` : ''}
            </span>
          </header>

          <div className="mb-3 flex flex-wrap gap-4 font-mono text-xs">
            <span className="text-green print:text-black">Productive {fmtHm(s.accounting.productiveMin)}</span>
            <span className={s.accounting.nptMin > 0 ? 'text-red' : 'text-muted-foreground'}>NPT {fmtHm(s.accounting.nptMin)}</span>
            <span className="text-muted-foreground">Logged {fmtHm(s.accounting.totalLoggedMin)}</span>
            <span className="text-muted-foreground">Gaps {s.accounting.unaccountedGaps.length}</span>
          </div>

          <table className="mb-3 w-full border-collapse text-xs">
            <thead>
              <tr>
                {['Code', 'Activity', 'Category', 'Time'].map((h) => (
                  <th key={h} className="pb-1 pr-3 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...s.accounting.byCode].sort((a, b) => b.minutes - a.minutes).map((t) => (
                <tr key={t.code} data-testid="report-tally-row" className="border-t border-white/[0.05] print:border-black/10">
                  <td className="py-1 pr-3 font-mono">{t.code}</td>
                  <td className="py-1 pr-3">{t.label}</td>
                  <td className="py-1 pr-3 text-muted-foreground">{t.category}</td>
                  <td className={`py-1 pr-3 font-mono ${t.npt ? 'text-red' : ''}`}>{fmtHm(t.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-3 font-mono text-xs text-muted-foreground">
            Crew: {s.parties.length ? s.parties.join(', ') : '—'} · Equipment: {s.equipment.length ? s.equipment.join(', ') : '—'}
          </div>

          {s.flaggedQc.length > 0 && (
            <ul className="mb-3 space-y-1">
              {s.flaggedQc.map((q, i) => (
                <li key={`${q.atMin}-${i}`} className="flex items-center gap-2 text-xs text-red">
                  <Flag className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                  QC flagged @ {fmtHm(q.atMin)}{q.note ? ` — ${q.note}` : ''}
                </li>
              ))}
            </ul>
          )}

          <div className="mb-3">
            <div className="mb-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">Journal</div>
            {s.journal.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {s.journal.map((j, i) => (
                  <li key={`${j.atMin}-${i}`} className="flex items-start gap-2">
                    <span className="shrink-0 rounded border border-white/[0.08] px-1 font-mono text-[0.625rem] text-muted-foreground">{KIND_LABEL[j.kind]}</span>
                    <span className="font-mono text-muted-foreground">{fmtHm(j.atMin)}</span>
                    <span className="text-cream print:text-black">{j.note ?? '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-xs text-muted-foreground/60">No journal entries.</p>
            )}
          </div>

          {(s.notifications.length > 0 || s.warnings.length > 0) && (
            <ul className="space-y-1 text-xs">
              {s.notifications.map((n) => (
                <li key={n.id} className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                  {n.title} <span className="text-muted-foreground/60">{n.detail}</span>
                </li>
              ))}
              {s.warnings.map((w, i) => (
                <li key={`${w}-${i}`} className="text-red">{w}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
