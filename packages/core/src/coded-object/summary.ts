import { findBankCode } from '../well-setup/bank';
import type { TicketView } from './types';

export interface TicketSummary {
  id: string;
  label?: string;
  code?: string;
  bankLabel?: string;
  category?: string;
  status?: string;
  parties: number;
  equipment: number;
  bha: number;
  timelineCount: number;
  latestActivity?: { code?: string; atMin: number; bankLabel?: string };
  warningCount: number;
}

/** Pure, deterministic projection of a TicketView into a card-friendly summary. */
export function summarizeTicket(view: TicketView): TicketSummary {
  const { section, parties, equipment, bha, timeline, warnings } = view;
  const bank = section.code ? findBankCode(section.code) : undefined;

  const statusRaw = section.fields?.status;
  const status = statusRaw === undefined || statusRaw === null || statusRaw === '' ? undefined : String(statusRaw);

  // Latest activity = the highest-seq event of kind 'activity' (timeline is seq-ordered).
  let latestActivity: TicketSummary['latestActivity'];
  for (const e of timeline) {
    if (e.kind === 'activity') {
      latestActivity = { code: e.code, atMin: e.atMin, bankLabel: e.code ? findBankCode(e.code)?.label : undefined };
    }
  }

  return {
    id: section.id,
    label: section.label,
    code: section.code,
    bankLabel: bank?.label,
    category: bank?.category,
    status,
    parties: parties.length,
    equipment: equipment.length,
    bha: bha.length,
    timelineCount: timeline.length,
    latestActivity,
    warningCount: warnings.length,
  };
}
