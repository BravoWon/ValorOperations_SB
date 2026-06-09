import type { RigDay, TimeBlock } from '../rig-day/types';
import { DAY_MINUTES } from '../rig-day/types';
import type { LaneItem } from '../rig-day/lanes';
import type { CodedObject, TicketView } from './types';

/** A CodedObject → LaneItem present for the whole operational day. */
function laneFrom(o: CodedObject): LaneItem {
  return { id: o.id, code: o.code ?? 'UNKNOWN', label: o.label ?? o.code ?? o.id, startMin: 0, endMin: DAY_MINUTES };
}

/**
 * Project a Ticket (section + append-only timeline + related objects) into the `RigDay`
 * shape the existing rig-day visual components consume. Pure/deterministic.
 *
 * - Only `activity` events become blocks; each spans from its `atMin` to the NEXT activity's
 *   `atMin` (or `DAY_MINUTES` for the last). Activities are taken in seq order.
 * - A `qc` event's mark is attached to the block whose [startMin, endMin) covers its `atMin`.
 * - Parties → `people` lanes, equipment → `equipment` lanes (present the full day).
 * - Depth is unavailable in the timeline schema, so blocks carry no depth (progress is empty).
 */
export function timelineToRigDay(ticket: TicketView): RigDay {
  const { section, parties, equipment, timeline } = ticket;
  const activities = timeline.filter((e) => e.kind === 'activity' && e.code);

  const blocks: TimeBlock[] = activities.map((e, i) => {
    const next = activities[i + 1];
    const endMin = next ? next.atMin : DAY_MINUTES;
    return { id: e.id, code: e.code as string, startMin: e.atMin, endMin, ...(e.note ? { note: e.note } : {}) };
  });

  for (const e of timeline) {
    if (e.kind !== 'qc' || !e.qc) continue;
    const block = blocks.find((b) => e.atMin >= b.startMin && e.atMin < b.endMin);
    if (block) block.qc = { status: e.qc.status, ...(e.qc.note ? { note: e.qc.note } : {}) };
  }

  return {
    id: section.id,
    label: section.label ?? section.code ?? section.id,
    blocks,
    people: parties.map(laneFrom),
    equipment: equipment.map(laneFrom),
  };
}
