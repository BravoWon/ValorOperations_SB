import type { Well } from '@valor/core';
import { Badge } from '@/components/ui/badge';

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? '—'}</div>
    </div>
  );
}

export function WellHeader({ well }: { well: Well }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">{well.name}</h1>
        {well.status && <Badge variant="secondary">{well.status}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="API #" value={well.apiNumber} />
        <Field label="Permit #" value={well.permitNumber} />
        <Field label="County / State" value={[well.county, well.state].filter(Boolean).join(', ')} />
        <Field label="Township / Section" value={[well.township, well.section].filter(Boolean).join(' / ')} />
        <Field label="Ground Elev (ft)" value={well.groundElevFt} />
        <Field label="KB Height (ft)" value={well.kbHeightFt} />
        <Field label="Surface Lat" value={well.surfaceLat} />
        <Field label="Surface Long" value={well.surfaceLong} />
      </div>
    </div>
  );
}
