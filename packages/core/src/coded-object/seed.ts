import type { CodedGraph, TimelineEvent } from './types';
import { DEMO_ORG_ID } from '../seed';

export const SEED_TICKET_ID = 'sec-int-1';
const ORG = DEMO_ORG_ID;

export const DEFAULT_CODED_GRAPH: CodedGraph = {
  objects: [
    {
      id: SEED_TICKET_ID, orgId: ORG, type: 'section', code: 'DRL', label: '12¼" Intermediate',
      fields: { sectionName: 'Intermediate', diameterIn: 12.25, status: 'in_progress', plannedStartMin: 0, plannedEndMin: 1440 },
    },
    { id: 'party-dd', orgId: ORG, type: 'party', code: 'DD', label: 'Directional Driller', fields: { onsite: true } },
    { id: 'party-mud', orgId: ORG, type: 'party', code: 'MUD', label: 'Mud Engineer', fields: { onsite: true } },
    { id: 'equip-rig', orgId: ORG, type: 'equipment', code: 'RIG', label: 'Rig', fields: {} },
    { id: 'equip-pumps', orgId: ORG, type: 'equipment', code: 'PUMPS', label: 'Triplex Pumps', fields: { count: 2 } },
    { id: 'bha-1', orgId: ORG, type: 'bha', label: 'Rotary BHA #1', fields: { bitSizeIn: 12.25 } },
    { id: 'job-1', orgId: ORG, type: 'job', label: 'Drill Intermediate', fields: {} },
  ],
  relations: [
    { id: 'rel-parent', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'job-1', kind: 'parent' },
    { id: 'rel-p1', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'party-dd', kind: 'assigned' },
    { id: 'rel-p2', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'party-mud', kind: 'assigned' },
    { id: 'rel-e1', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'equip-rig', kind: 'uses' },
    { id: 'rel-e2', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'equip-pumps', kind: 'uses' },
    { id: 'rel-b1', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'bha-1', kind: 'uses' },
  ],
};

export const DEFAULT_TIMELINE: TimelineEvent[] = [
  { id: 'ev-1', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 1, atMin: 0, kind: 'activity', code: 'TIH', note: 'Trip in hole' },
  { id: 'ev-2', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 2, atMin: 120, kind: 'activity', code: 'DRL', note: 'Drilling ahead' },
  { id: 'ev-3', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 3, atMin: 510, kind: 'activity', code: 'RIGREP', note: 'Rig repair (NPT)' },
  { id: 'ev-4', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 4, atMin: 600, kind: 'qc', qc: { status: 'approved' as const, note: 'Tower QC complete' } },
];
