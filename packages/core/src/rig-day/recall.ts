export interface RecallItem {
  id: string; code: string; label: string;
  wellLabel: string; dayLabel: string;
  startMin: number; endMin: number;
  depthStartFt?: number; depthEndFt?: number;
  note?: string;
}

export const RECALL_LIBRARY: RecallItem[] = [
  { id: 'r1', code: 'TIH', label: 'Tripping In', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 0, endMin: 110, depthStartFt: 0, depthEndFt: 6200, note: 'Clean trip, no fill.' },
  { id: 'r2', code: 'DRL', label: 'Drilling', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 150, endMin: 470, depthStartFt: 6200, depthEndFt: 6950, note: 'Avg ROP 42 ft/hr.' },
  { id: 'r3', code: 'CONN', label: 'Connection', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 470, endMin: 495 },
  { id: 'r4', code: 'RIGREP', label: 'Rig Repair', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 495, endMin: 560, note: 'Pop-off valve replaced.' },
  { id: 'r5', code: 'DRL', label: 'Drilling', wellLabel: 'Well B', dayLabel: 'Day 1', startMin: 200, endMin: 520, depthStartFt: 5800, depthEndFt: 6600, note: 'Hard stringers, ROP 31.' },
  { id: 'r6', code: 'CMT', label: 'Cementing', wellLabel: 'Well B', dayLabel: 'Day 4', startMin: 600, endMin: 690, note: '15.8 ppg lead, 16.4 tail.' },
  { id: 'r7', code: 'CSG', label: 'Run Casing', wellLabel: 'Well B', dayLabel: 'Day 4', startMin: 300, endMin: 600, depthStartFt: 0, depthEndFt: 6400 },
  { id: 'r8', code: 'TOH', label: 'Tripping Out', wellLabel: 'Well B', dayLabel: 'Day 5', startMin: 0, endMin: 130, depthStartFt: 6400, depthEndFt: 0 },
  { id: 'r9', code: 'SVY', label: 'Survey / Directional', wellLabel: 'Well C', dayLabel: 'Day 2', startMin: 480, endMin: 520 },
  { id: 'r10', code: 'CIRC', label: 'Circulating', wellLabel: 'Well C', dayLabel: 'Day 2', startMin: 110, endMin: 150, note: 'Bottoms-up before survey.' },
  { id: 'r11', code: 'TIH', label: 'Tripping In', wellLabel: 'Well C', dayLabel: 'Day 3', startMin: 0, endMin: 125, depthStartFt: 0, depthEndFt: 7000 },
  { id: 'r12', code: 'DRL', label: 'Drilling', wellLabel: 'Well C', dayLabel: 'Day 3', startMin: 160, endMin: 540, depthStartFt: 7000, depthEndFt: 7820, note: 'Best day, ROP 55.' },
];

export function findLikeItems(code: string, library: RecallItem[] = RECALL_LIBRARY): RecallItem[] {
  return library
    .filter((i) => i.code === code)
    .sort((a, b) => a.wellLabel.localeCompare(b.wellLabel) || a.dayLabel.localeCompare(b.dayLabel));
}
