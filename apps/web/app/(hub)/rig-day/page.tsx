'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import {
  deriveTimeAccounting,
  findBankCode,
  snapTo5,
  DEFAULT_RIG_DAY,
  DAY_MINUTES,
  type RigDay,
  type TimeBlock,
} from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RigDayTimeline } from '@/components/rig-day-timeline';
import { BankPalette } from '@/components/bank-palette';
import { RigDayEditors } from '@/components/rig-day-editors';
import { TimeAccountingRail } from '@/components/time-accounting-rail';
import { LoadingState } from '@/components/ui/states';

const RIG_DAY_ID = 'demo';
const BLOCK_MINUTES = 30;

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

function hMM(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
}

export default function RigDayPage() {
  const [day, setDay] = useState<RigDay>(DEFAULT_RIG_DAY);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Monotonic counter for deterministic block ids — no Date.now()/Math.random().
  const addCounter = useRef(0);

  useEffect(() => {
    let active = true;
    getRepo()
      .loadRigDay(RIG_DAY_ID)
      .then((stored) => {
        if (!active) return;
        if (stored) setDay(stored);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const accounting = useMemo(() => deriveTimeAccounting(day.blocks), [day.blocks]);

  const nowMin = day.blocks.length
    ? Math.max(...day.blocks.map((b) => b.endMin))
    : 0;
  // "Rig Now" = the block ending latest (covering now), else the last in the list.
  const rigNow =
    day.blocks.length > 0
      ? day.blocks.reduce((a, b) => (b.endMin >= a.endMin ? b : a))
      : undefined;

  const addBlock = (code: string) => {
    setDay((prev) => {
      const lastEnd = prev.blocks.length
        ? Math.max(...prev.blocks.map((b) => b.endMin))
        : 0;
      const startMin = snapTo5(lastEnd);
      if (startMin >= DAY_MINUTES) return prev; // day already full — don't append a zero-width block
      const endMin = Math.min(DAY_MINUTES, snapTo5(startMin + BLOCK_MINUTES));
      addCounter.current += 1;
      const block: TimeBlock = {
        id: `b-add-${addCounter.current}-${startMin}`,
        code,
        startMin,
        endMin,
      };
      return { ...prev, blocks: [...prev.blocks, block] };
    });
  };

  const onSave = async () => {
    setSaveState('saving');
    await getRepo().saveRigDay(RIG_DAY_ID, day);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  const rigNowBank = rigNow ? findBankCode(rigNow.code) : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Field Operations · Rig Day"
        title={day.label || 'Rig Day'}
        subtitle="Log the shift in coded blocks on a 24-hour timeline and watch the time-accounting fall out — productive vs NPT, hours by activity, unaccounted gaps."
        actions={
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === 'saving'}
            className={BTN_CLASS}
          >
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        }
      />

      {loaded ? (
        <div className="space-y-6">
          {/* Timeline + Rig Now */}
          <Card>
            <CardHeader>
              <CardTitle>24-Hour Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <RigDayTimeline day={day} />

              {/* "Rig Now" strip */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-gold/15 bg-gold/[0.04] px-4 py-3">
                <div className="eyebrow">Rig Now</div>
                {rigNow ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-medium text-gold-light">
                        {rigNow.code}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {rigNowBank?.label ?? 'Unknown code'}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/80">
                      {`${hMM(rigNow.startMin)}–${hMM(rigNow.endMin)} · ${hMM(
                        rigNow.endMin - rigNow.startMin,
                      )} elapsed`}
                    </div>
                    {Number.isFinite(rigNow.depthEndFt) && (
                      <div className="font-mono text-xs text-muted-foreground/80">
                        {`${rigNow.depthEndFt?.toLocaleString()} ft MD`}
                      </div>
                    )}
                    <div className="ml-auto font-mono text-xs text-muted-foreground/60">
                      {`Now @ ${hMM(nowMin)}`}
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No blocks logged yet.</span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
            {/* Left: editing surface */}
            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add From the Bank</CardTitle>
                </CardHeader>
                <CardContent>
                  <BankPalette onAdd={addBlock} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Coded Blocks</CardTitle>
                </CardHeader>
                <CardContent>
                  <RigDayEditors day={day} onChange={setDay} />
                </CardContent>
              </Card>
            </div>

            {/* Right: live time-accounting rail + warnings */}
            <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>Time Accounting</CardTitle>
                </CardHeader>
                <CardContent>
                  <TimeAccountingRail accounting={accounting} />
                </CardContent>
              </Card>

              {accounting.warnings.length > 0 && (
                <ul className="space-y-1.5">
                  {accounting.warnings.map((w, i) => (
                    <li
                      key={`${w}-${i}`}
                      className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
