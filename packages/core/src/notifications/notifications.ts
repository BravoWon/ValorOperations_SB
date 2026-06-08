import type { RigDay } from '../rig-day/types';
import { deriveTimeAccounting } from '../rig-day/time-accounting';
import { findBankCode } from '../well-setup/bank';

export type NotificationSeverity = 'info' | 'warn' | 'critical';
export type NotificationCategory = 'NPT' | 'gap' | 'qc';
export interface Notification { id: string; severity: NotificationSeverity; category: NotificationCategory; title: string; detail: string; }
export interface NotificationRules { nptThresholdMin: number; gapThresholdMin: number; }
export const DEFAULT_NOTIFICATION_RULES: NotificationRules = { nptThresholdMin: 60, gapThresholdMin: 30 };

const SEV_ORDER: Record<NotificationSeverity, number> = { critical: 0, warn: 1, info: 2 };
function hMM(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

export function deriveNotifications(rigDay: RigDay, rules: NotificationRules = DEFAULT_NOTIFICATION_RULES): Notification[] {
  const out: Notification[] = [];
  const blocks = rigDay?.blocks ?? [];
  const acc = deriveTimeAccounting(blocks);

  if (acc.nptMin > rules.nptThresholdMin) {
    out.push({
      id: 'ntf-NPT-1', severity: 'critical', category: 'NPT',
      title: `NPT ${hMM(acc.nptMin)} exceeds ${hMM(rules.nptThresholdMin)} limit`,
      detail: `Non-productive time is ${hMM(acc.nptMin)} of ${hMM(acc.totalLoggedMin)} logged.`,
    });
  }

  let g = 0;
  for (const gap of acc.unaccountedGaps) {
    const dur = gap.endMin - gap.startMin;
    if (dur > rules.gapThresholdMin) {
      g += 1;
      out.push({
        id: `ntf-gap-${g}`, severity: 'warn', category: 'gap',
        title: `Unaccounted ${hMM(dur)} gap`,
        detail: `No activity logged ${hMM(gap.startMin)}–${hMM(gap.endMin)}.`,
      });
    }
  }

  let q = 0;
  for (const b of blocks) {
    if (b.qc?.status === 'flagged') {
      q += 1;
      const label = findBankCode(b.code)?.label ?? b.code;
      out.push({
        id: `ntf-qc-${q}`, severity: 'warn', category: 'qc',
        title: `QC flag on ${label}`,
        detail: b.qc.note ? b.qc.note : `Block ${b.code} flagged for review.`,
      });
    }
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}
