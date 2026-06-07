import type { Well } from '@valor/core';
import { Badge } from '@/components/ui/badge';

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
      <div className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-gold/60">
        {label}
      </div>
      <div className="data mt-1 text-sm text-cream">
        {value ?? <span className="text-muted-foreground/40">—</span>}
      </div>
    </div>
  );
}

export function WellHeader({ well }: { well: Well }) {
  return (
    <div className="glass relative overflow-hidden rounded-lg p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/[0.06] blur-3xl" />
      <div className="relative">
        <div className="eyebrow mb-2">Wellbore Record</div>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-medium tracking-tight text-cream">
            {well.name}
          </h1>
          {well.status && <Badge variant="info">{well.status}</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="API #" value={well.apiNumber} />
          <Field label="Permit #" value={well.permitNumber} />
          <Field label="County / State" value={[well.county, well.state].filter(Boolean).join(', ')} />
          <Field
            label="Township / Section"
            value={[well.township, well.section].filter(Boolean).join(' / ')}
          />
          <Field label="Ground Elev (ft)" value={well.groundElevFt} />
          <Field label="KB Height (ft)" value={well.kbHeightFt} />
          <Field label="Surface Lat" value={well.surfaceLat} />
          <Field label="Surface Long" value={well.surfaceLong} />
        </div>
      </div>
    </div>
  );
}
