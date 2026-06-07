'use client';
import { registerWidget } from '@/lib/widgets/registry';

function PowerBiStub() {
  return <div className="text-sm text-muted-foreground">Power BI embed — coming soon (O365 integration phase).</div>;
}

registerWidget(
  { id: 'power-bi', title: 'Power BI', description: 'Embedded Power BI report.', category: 'embed', defaultSize: { w: 6, h: 6 } },
  PowerBiStub,
);
export {};
