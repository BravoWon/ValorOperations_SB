import { Activity, AlertOctagon, AlertTriangle, Flame, Info, type LucideIcon } from 'lucide-react';
import { DAY_MINUTES, type Notification, type NotificationSeverity, type RigDay, type TimeAccounting } from '@valor/core';
import { DayBoardRow } from '@/components/day-board-row';

export interface DayBoardEntry {
  day: RigDay;
  accounting: TimeAccounting;
  notifications: Notification[];
  sectionLabel: string;
  href: string;
}

export interface OperatorsDayBoardProps {
  rows: DayBoardEntry[];
}

function fmtHm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function pct(min: number): string {
  return `${(min / DAY_MINUTES) * 100}%`;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);

type Tone = 'gold' | 'green' | 'cyan' | 'red';
const TONE: Record<Tone, { text: string; ring: string; glow: string }> = {
  gold: { text: 'text-gold', ring: 'border-gold/30 bg-gold/10', glow: 'from-gold/[0.12]' },
  green: { text: 'text-green', ring: 'border-green/30 bg-green/10', glow: 'from-green/[0.1]' },
  cyan: { text: 'text-cyan', ring: 'border-cyan/30 bg-cyan/10', glow: 'from-cyan/[0.1]' },
  red: { text: 'text-red', ring: 'border-red/30 bg-red/10', glow: 'from-red/[0.1]' },
};

// Severity conventions mirror notifications-panel.tsx (panel not modified by this slice).
const SEV: Record<NotificationSeverity, { row: string; icon: LucideIcon; text: string }> = {
  critical: { row: 'border-red/25 bg-red/[0.06]', icon: AlertOctagon, text: 'text-red' },
  warn: { row: 'border-gold/25 bg-gold/[0.05]', icon: AlertTriangle, text: 'text-gold-light' },
  info: { row: 'border-white/10 bg-white/[0.04]', icon: Info, text: 'text-muted-foreground' },
};
const SEV_ORDER: NotificationSeverity[] = ['critical', 'warn', 'info'];

/** The whole-day spine: KPI roll-up + every section's day on one shared 24h axis. */
export function OperatorsDayBoard({ rows }: OperatorsDayBoardProps) {
  const productiveMin = rows.reduce((s, r) => s + r.accounting.productiveMin, 0);
  const nptMin = rows.reduce((s, r) => s + r.accounting.nptMin, 0);

  const cards: { label: string; value: string; tone: Tone; icon: LucideIcon }[] = [
    { label: 'Productive', value: fmtHm(productiveMin), tone: 'green', icon: Flame },
    { label: 'NPT', value: fmtHm(nptMin), tone: nptMin > 0 ? 'red' : 'gold', icon: AlertTriangle },
    { label: 'Active sections', value: String(rows.length).padStart(2, '0'), tone: 'cyan', icon: Activity },
  ];

  const tagged = rows
    .flatMap((r) => r.notifications.map((n) => ({ ...n, sectionLabel: r.sectionLabel, key: `${r.day.id}-${n.id}` })))
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  return (
    <div className="space-y-6">
      {/* Aggregate KPI cards (per-section sums — never concatenated blocks). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          const tone = TONE[c.tone];
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass lift relative overflow-hidden rounded-lg p-5">
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tone.glow} to-transparent blur-2xl`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="data text-4xl font-semibold leading-none text-cream">{c.value}</div>
                  <div className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">{c.label}</div>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${tone.ring}`}>
                  <Icon className={`h-4 w-4 ${tone.text}`} strokeWidth={1.75} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared hour axis (once), offset by the row gutter width + gap. */}
      <div>
        <div className="mb-1 flex items-center gap-3">
          <div className="w-40 shrink-0" />
          <div className="relative h-4 flex-1">
            {HOURS.filter((h) => h % 3 === 0).map((h) => (
              <span
                key={`axis-${h}`}
                className="absolute top-0 -translate-x-1/2 font-mono text-[0.625rem] text-muted-foreground/60"
                style={{ left: pct(h * 60) }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {rows.map((r) => (
            <DayBoardRow key={r.day.id} day={r.day} href={r.href} />
          ))}
        </div>
      </div>

      {/* Section-tagged notifications, severity-ordered. */}
      {tagged.length > 0 ? (
        <ul className="space-y-1.5">
          {tagged.map((n) => {
            const sev = SEV[n.severity];
            const Icon = sev.icon;
            return (
              <li key={n.key} data-testid="day-notification" className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${sev.row}`}>
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${sev.text}`} strokeWidth={2} aria-hidden="true" />
                <span className="flex-1">
                  <span className="text-cream">{n.title}</span>
                  <span className="ml-2 text-muted-foreground/70">{n.detail}</span>
                </span>
                <span className="shrink-0 rounded-md border border-white/[0.08] bg-background/40 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
                  {n.sectionLabel}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-mono text-xs text-muted-foreground/60">All clear — no exceptions across active sections.</p>
      )}
    </div>
  );
}
