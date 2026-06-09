'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import {
  assembleTicket,
  objectsByType,
  timelineToRigDay,
  deriveTimeAccounting,
  deriveProgress,
  deriveNotifications,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  BANK_SEED,
  type CodedGraph,
  type TimelineEvent,
  type BankCode,
  type RigDay,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState, EmptyState } from '@/components/ui/states';
import { RigDayTimeline } from '@/components/rig-day-timeline';
import { RigDayLanes } from '@/components/rig-day-lanes';
import { TimeAccountingRail } from '@/components/time-accounting-rail';
import { NotificationsPanel } from '@/components/notifications-panel';
import { BankSearchPalette } from '@/components/bank-search-palette';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export function TicketTimeView({ ticketId }: { ticketId: string }) {
  const [day, setDay] = useState<RigDay | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bankCodes, setBankCodes] = useState<BankCode[]>(BANK_SEED);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useMemo(
    () => async () => {
      const repo = getRepo();
      let graph: CodedGraph = await repo.loadCodedGraph(DEMO_ORG_ID);
      let usingSeed = false;
      if (objectsByType(graph, 'section').length === 0) {
        graph = DEFAULT_CODED_GRAPH;
        usingSeed = true;
      }
      let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, ticketId);
      if (events.length === 0 && usingSeed) events = DEFAULT_TIMELINE.filter((e) => e.ticketId === ticketId);
      return assembleTicket(graph, events, ticketId);
    },
    [ticketId],
  );

  useEffect(() => {
    let active = true;
    // Reset on ticket change (client-side nav re-uses this instance): clears stale data so the
    // previous ticket never flashes, and `!day` blocks onPick until the new load resolves.
    setLoaded(false);
    setDay(null);
    setWarnings([]);
    load()
      .then((view) => {
        if (!active) return;
        setDay(view ? timelineToRigDay(view) : null);
        setWarnings(view?.warnings ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    getRepo().loadBankCodes().then((stored) => { if (active && stored) setBankCodes(stored); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const accounting = useMemo(() => (day ? deriveTimeAccounting(day.blocks) : null), [day]);
  const progress = useMemo(() => (day ? deriveProgress(day.blocks) : []), [day]);
  const notifications = useMemo(() => (day ? deriveNotifications(day) : []), [day]);

  const onPick = async (code: BankCode) => {
    if (!day || saving) return; // guard re-entrancy + the not-loaded case
    setSaving(true);
    try {
      // Append 30 min after the LATEST time-of-day block start (max startMin — not "last in
      // seq", which could be earlier on the axis and create a non-positive span). Uses the
      // loaded blocks — no extra round-trip. Clamp strictly below end-of-day so the new block
      // always has a visible, accountable span (atMin 1440 would project to [1440,1440)).
      const maxAt = day.blocks.reduce((m, b) => Math.max(m, b.startMin), -30);
      const atMin = Math.max(0, Math.min(1439, maxAt + 30));
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ev-${atMin}-${code.code}-${day.blocks.length + 1}`;
      await getRepo().appendTimelineEvent({ id, orgId: DEMO_ORG_ID, ticketId, atMin, kind: 'activity', code: code.code });
      const view = await load();
      if (!mountedRef.current) return;
      setDay(view ? timelineToRigDay(view) : null);
      setWarnings(view?.warnings ?? []);
    } catch {
      // Append failed (e.g. the Supabase scaffold throws) — leave the view as-is.
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operate · Ticket time-view"
        title={day?.label ?? 'Ticket'}
        subtitle="The section's append-only activity timeline, rendered on the 24-hour rig-day axis. Log an activity from the Bank."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/tickets" className="inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-gold-light">
              <ArrowLeft className="h-3 w-3" /> Board
            </Link>
            {day && (
              <button type="button" onClick={() => setPaletteOpen(true)} disabled={saving} className={BTN_CLASS}>
                <Search className="h-3.5 w-3.5" strokeWidth={2} /> {saving ? 'Logging…' : 'Log activity'}
              </button>
            )}
          </div>
        }
      />

      {!loaded ? (
        <LoadingState />
      ) : !day ? (
        <EmptyState title="Ticket not found" description="No section with this id exists in the coded-object graph." />
      ) : (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={`${w}-${i}`} className="rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red">{w}</li>
              ))}
            </ul>
          )}
          <Card><CardHeader><CardTitle>24-Hour Timeline</CardTitle></CardHeader><CardContent>
            <RigDayTimeline day={day} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Parties &amp; Equipment</CardTitle></CardHeader><CardContent>
            <RigDayLanes day={day} progress={progress} />
          </CardContent></Card>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {accounting && <Card><CardHeader><CardTitle>Time Accounting</CardTitle></CardHeader><CardContent><TimeAccountingRail accounting={accounting} /></CardContent></Card>}
            <Card><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent><NotificationsPanel notifications={notifications} /></CardContent></Card>
          </div>
        </div>
      )}

      <BankSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} codes={bankCodes} onSelect={onPick} />
    </div>
  );
}
