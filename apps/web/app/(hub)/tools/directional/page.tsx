import { DirectionalPanel } from '@/components/directional-panel';
import { PageHeader } from '@/components/ui/page-header';

export default function DirectionalPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Calculator"
        title="Directional Survey"
        subtitle="Minimum-curvature trajectory from survey stations — TVD, north/east, vertical section, closure, and dogleg severity."
      />
      <DirectionalPanel />
    </div>
  );
}
