'use client';

import { useActiveOrg } from '@/components/active-org-provider';

/** Active-org switcher: a dropdown when the user belongs to >1 org, a static label
 *  when they have exactly one, and nothing in mock mode (no context). */
export function OrgSwitcher() {
  const ctx = useActiveOrg();
  if (!ctx || ctx.orgs.length === 0) return null;

  if (ctx.orgs.length === 1) {
    const only = ctx.orgs[0];
    if (!only) return null;
    return (
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/70">Org</span>
        <span className="font-mono text-[0.6875rem] text-cream">{only.name}</span>
      </div>
    );
  }

  return (
    <label className="mb-6 flex items-center gap-2 px-2">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/70">Org</span>
      <select
        aria-label="Active organization"
        value={ctx.activeOrgId}
        onChange={(e) => ctx.setActiveOrg(e.target.value)}
        className="flex-1 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-[0.6875rem] text-cream outline-none transition-colors focus:border-gold/50"
      >
        {ctx.orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
