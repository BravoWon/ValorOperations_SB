'use client';
import { registerWidget } from '@/lib/widgets/registry';
import { HydraulicsPanel } from '@/components/hydraulics-panel';

function HydraulicsWidget() {
  return <HydraulicsPanel />;
}

registerWidget(
  { id: 'hydraulics', title: 'Hydraulics & Circulation', description: 'Annular volumes, pump output, bottoms-up, pressures.', category: 'compute', defaultSize: { w: 8, h: 12 }, minSize: { w: 5, h: 8 } },
  HydraulicsWidget,
);
export {};
