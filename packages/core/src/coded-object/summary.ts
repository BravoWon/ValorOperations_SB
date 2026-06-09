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

  const statusRaw = section.fields.status;
  const status = statusRaw == null || statusRaw === '' ? undefined : String(statusRaw);

  // Latest activity = the last event of kind 'activity' (timeline is seq-ordered);
  // resolve its Bank label once.
  let lastAct: TicketView['timeline'][number] | undefined;
  for (const e of timeline) {
    if (e.kind === 'activity') lastAct = e;
  }
  const latestActivity: TicketSummary['latestActivity'] = lastAct
    ? { code: lastAct.code, atMin: lastAct.atMin, bankLabel: lastAct.code ? findBankCode(lastAct.code)?.label : undefined }
    : undefined;

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
