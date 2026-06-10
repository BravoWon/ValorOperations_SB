'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { deriveHandoff, type TicketView } from '@valor/core';

export interface HandoffDrawerProps {
  open: boolean;
  view: TicketView;
  onSign: (cutoffMin: number, narrative: string) => void;
  onClose: () => void;
}

/** Format a minute-of-day count as zero-padded `HH:MM` (negatives clamp to 0; fractions round). */
function fmtHm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const INPUT_CLASS =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

/** Review → annotate → sign. Signing appends a `milestone` event (the caller wires the append). */
export function HandoffDrawer({ open, view, onSign, onClose }: HandoffDrawerProps) {
  // Default to the latest logged event — the handoff is "as of now", so the still-open
  // activity (the last block, projected to end-of-day) correctly carries forward.
  const defaultCutoff = useMemo(
    () => (view.timeline.length ? view.timeline.reduce((m, e) => Math.max(m, e.atMin), 0) : 1440),
    [view.timeline],
  );
  const [cutoff, setCutoff] = useState<number>(defaultCutoff);
  const [narrative, setNarrative] = useState('');

  // The parent keeps this mounted while closed (it just returns null), so the ephemeral review
  // state survives across opens. Reset on each closed→open edge — otherwise a stale cutoff or
  // narrative (including one left over after the timeline changed) would resurface on reopen.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setCutoff(defaultCutoff);
      setNarrative('');
    }
    wasOpen.current = open;
  }, [open, defaultCutoff]);

  const handoff = useMemo(() => deriveHandoff(view, cutoff), [view, cutoff]);

  if (!open) return null;

  return (
    <div data-testid="handoff-drawer" className="glass-strong fixed inset-x-0 bottom-0 z-40 border-t border-gold/20 p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm text-cream">Shift handoff — {handoff.sectionLabel}</h3>
          <button type="button" aria-label="Close handoff" onClick={onClose} className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:text-cream">
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        <label className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          Cutoff (min of day)
          <input
            type="number"
            min={0}
            max={1440}
            step={5}
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value === '' ? 0 : Number(e.target.value))}
            className={`${INPUT_CLASS} w-24`}
          />
          <span className="normal-case">= {fmtHm(handoff.cutoffMin)}</span>
        </label>

        <div className="flex flex-wrap gap-3 font-mono text-xs">
          {handoff.completedWork.map((t) => (
            <span key={t.code} className={t.npt ? 'text-red' : 'text-muted-foreground'}>
              {t.code} {fmtHm(t.minutes)}
            </span>
          ))}
          {handoff.completedWork.length === 0 && <span className="text-muted-foreground/60">No completed work before the cutoff.</span>}
        </div>

        <div className="font-mono text-xs">
          {handoff.carryForwardBlock ? (
            <span className="text-gold-light">
              {handoff.carryForwardBlock.code} carries forward (open since {fmtHm(handoff.carryForwardBlock.startMin)})
            </span>
          ) : (
            <span className="text-muted-foreground/60">No carry-forward — the cutoff falls on a block boundary.</span>
          )}
          {handoff.pendingQcFlags.length > 0 && (
            <span className="ml-3 text-red">{handoff.pendingQcFlags.length} QC flag(s) pending</span>
          )}
        </div>

        <label className="flex flex-col gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          Narrative
          <textarea
            rows={2}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="What the next shift needs to know…"
            className={`${INPUT_CLASS} w-full normal-case`}
          />
        </label>

        <div>
          <button type="button" onClick={() => onSign(handoff.cutoffMin, narrative.trim())} className={BTN_CLASS}>
            Sign handoff
          </button>
        </div>
      </div>
    </div>
  );
}
