import type { RigDay } from './types';
export const DEFAULT_RIG_DAY: RigDay = {
  id: 'demo', label: 'Day 1',
  blocks: [
    { id: 'b1', code: 'TIH',    startMin: 0,   endMin: 120,  depthStartFt: 0,    depthEndFt: 6400 },
    { id: 'b2', code: 'CIRC',   startMin: 120,  endMin: 165 },
    { id: 'b3', code: 'DRL',    startMin: 165,  endMin: 480,  depthStartFt: 6400, depthEndFt: 7100 },
    { id: 'b4', code: 'CONN',   startMin: 480,  endMin: 510 },
    { id: 'b5', code: 'RIGREP', startMin: 510,  endMin: 600 },   // NPT
    { id: 'b6', code: 'DRL',    startMin: 600,  endMin: 840,  depthStartFt: 7100, depthEndFt: 7480 },
    { id: 'b7', code: 'SVY',    startMin: 840,  endMin: 885 },
  ],
  people: [
    { id: 'p1', code: 'DD', label: 'DD (days)', startMin: 0, endMin: 720 },
    { id: 'p2', code: 'MWD', label: 'MWD (days)', startMin: 0, endMin: 720 },
    { id: 'p3', code: 'MUD', label: 'Mud Engineer', startMin: 120, endMin: 885 },
    { id: 'p4', code: 'INSP', label: 'BOP Inspector', startMin: 480, endMin: 600 },
  ],
  equipment: [
    { id: 'e1', code: 'RIG', label: 'Rig', startMin: 0, endMin: 885 },
    { id: 'e2', code: 'PUMPS', label: 'Triplex Pumps', startMin: 120, endMin: 840 },
    { id: 'e3', code: 'WLUNIT', label: 'Wireline Unit', startMin: 840, endMin: 885 },
  ],
};
