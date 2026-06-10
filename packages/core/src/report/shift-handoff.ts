import type { TicketView } from '../coded-object/types';
import { timelineToRigDay } from '../coded-object/timeline-view';
import { deriveTimeAccounting } from '../rig-day/time-accounting';
import { DAY_MINUTES, type CodeTally, type TimeBlock } from '../rig-day/types';
import { deriveNotifications, DEFAULT_NOTIFICATION_RULES, type Notification, type NotificationRules } from '../notifications/notifications';

export interface ShiftHandoff {
  ticketId: string;
  sectionLabel: string;
  cutoffMin: number;
  completedWork: CodeTally[];
  carryForwardBlock: TimeBlock | null;
  pendingQcFlags: { atMin: number; note?: string }[];
  pendingNotifications: Notification[];
  warnings: string[];
}

/**
 * Derive a shift-handoff summary at an operator-chosen cutoff minute. Pure/deterministic;
 * never throws (an out-of-range cutoff clamps to [0, DAY_MINUTES] with a warning).
 * Carry-forward is COMPUTED, never stored — signing records a `milestone` event instead.
 */
export function deriveHandoff(view: TicketView, cutoffMin: number, rules: NotificationRules = DEFAULT_NOTIFICATION_RULES): ShiftHandoff {
  const warnings: string[] = [...view.warnings];

  let cutoff = cutoffMin;
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > DAY_MINUTES) {
    cutoff = Math.max(0, Math.min(DAY_MINUTES, Number.isFinite(cutoff) ? cutoff : DAY_MINUTES));
    warnings.push(`Cutoff out of range; clamped to ${cutoff} min.`);
  }

  const day = timelineToRigDay(view);

  // Truncate the projected blocks at the cutoff: keep what finished before it; clip the
  // block spanning it (its pre-cutoff span counts as completed work).
  const truncated: TimeBlock[] = [];
  let carryForwardBlock: TimeBlock | null = null;
  for (const b of day.blocks) {
    if (b.endMin <= cutoff) {
      truncated.push(b);
    } else if (b.startMin < cutoff) {
      truncated.push({ ...b, endMin: cutoff });
      carryForwardBlock = b; // the original, untruncated — what the next shift inherits
    }
  }

  const accounting = deriveTimeAccounting(truncated);
  const pendingNotifications = deriveNotifications({ ...day, blocks: truncated }, rules);

  const pendingQcFlags = view.timeline
    .filter((e) => e.kind === 'qc' && e.qc?.status === 'flagged' && e.atMin < cutoff)
    .map((e) => ({ atMin: e.atMin, ...(e.qc?.note ? { note: e.qc.note } : {}) }));

  return {
    ticketId: view.section.id,
    sectionLabel: view.section.label ?? view.section.code ?? view.section.id,
    cutoffMin: cutoff,
    completedWork: accounting.byCode,
    carryForwardBlock,
    pendingQcFlags,
    pendingNotifications,
    // De-dupe (G1 convention): both layers can flag the same issue.
    warnings: [...new Set([...warnings, ...accounting.warnings])],
  };
}
