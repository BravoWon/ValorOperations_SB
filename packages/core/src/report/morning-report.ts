import { findBankCode } from '../well-setup/bank';
import type { TicketView } from '../coded-object/types';
import { timelineToRigDay } from '../coded-object/timeline-view';
import { deriveTimeAccounting } from '../rig-day/time-accounting';
import type { TimeAccounting } from '../rig-day/types';
import { deriveNotifications, DEFAULT_NOTIFICATION_RULES, type Notification, type NotificationRules } from '../notifications/notifications';

export interface MorningReportSection {
  ticketId: string;
  sectionLabel: string;
  code?: string;
  bankLabel?: string;
  status?: string;
  accounting: TimeAccounting;
  parties: string[];
  equipment: string[];
  flaggedQc: { atMin: number; note?: string }[];
  journal: { atMin: number; kind: 'note' | 'hse' | 'milestone'; note?: string }[];
  notifications: Notification[];
  warnings: string[];
}

/**
 * Derive a per-section morning-report summary from the assembled ticket. Pure/deterministic
 * (no clock — the report covers the ticket's logged day as-is). Never throws; issues
 * surface in `warnings` (assembleTicket warnings + time-accounting warnings, merged).
 */
export function deriveMorningReport(view: TicketView, rules: NotificationRules = DEFAULT_NOTIFICATION_RULES): MorningReportSection {
  const { section, parties, equipment, timeline, warnings: viewWarnings } = view;
  const day = timelineToRigDay(view);
  const accounting = deriveTimeAccounting(day.blocks);
  const notifications = deriveNotifications(day, rules);

  const bank = section.code ? findBankCode(section.code) : undefined;
  const statusRaw = section.fields.status;
  const status = statusRaw == null || statusRaw === '' ? undefined : String(statusRaw);

  const flaggedQc = timeline
    .filter((e) => e.kind === 'qc' && e.qc?.status === 'flagged')
    .map((e) => ({ atMin: e.atMin, ...(e.qc?.note ? { note: e.qc.note } : {}) }));

  const journal = timeline
    .filter((e): e is typeof e & { kind: 'note' | 'hse' | 'milestone' } => e.kind === 'note' || e.kind === 'hse' || e.kind === 'milestone')
    .map((e) => ({ atMin: e.atMin, kind: e.kind, ...(e.note ? { note: e.note } : {}) }));

  const label = (o: { label?: string; code?: string; id: string }) => o.label ?? o.code ?? o.id;

  return {
    ticketId: section.id,
    sectionLabel: section.label ?? section.code ?? section.id,
    code: section.code,
    bankLabel: bank?.label,
    status,
    accounting,
    parties: parties.map(label),
    equipment: equipment.map(label),
    flaggedQc,
    journal,
    notifications,
    warnings: [...viewWarnings, ...accounting.warnings],
  };
}
