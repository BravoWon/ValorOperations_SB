import { HydraulicsPanel } from '@/components/hydraulics-panel';

export default function HydraulicsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow">Calculator</div>
        <h1 className="font-display text-2xl text-cream">Hydraulics &amp; Circulation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Annular volumes, pump output, bottoms-up, and pressures from rig &amp; fluid inputs.
        </p>
      </div>
      <HydraulicsPanel />
    </div>
  );
}
