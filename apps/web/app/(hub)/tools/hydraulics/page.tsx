import { HydraulicsPanel } from '@/components/hydraulics-panel';
import { PageHeader } from '@/components/ui/page-header';

export default function HydraulicsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Calculator"
        title="Hydraulics & Circulation"
        subtitle="Annular volumes, pump output, bottoms-up, and pressures from rig & fluid inputs."
      />
      <HydraulicsPanel />
    </div>
  );
}
