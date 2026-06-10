'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import {
  assembleTicket,
  objectsByType,
  deriveMorningReport,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  type CodedGraph,
  type TimelineEvent,
  type MorningReportSection,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { MorningReportView } from '@/components/morning-report-view';
import { LoadingState, EmptyState } from '@/components/ui/states';

const BTN_CLASS =
  'print:hidden flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function MorningReportPage() {
  const [sections, setSections] = useState<MorningReportSection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const repo = getRepo();
      let graph: CodedGraph = await repo.loadCodedGraph(DEMO_ORG_ID);
      let usingSeed = false;
      let secs = objectsByType(graph, 'section');
      if (secs.length === 0) {
        graph = DEFAULT_CODED_GRAPH;
        usingSeed = true;
        secs = objectsByType(graph, 'section');
      }
      const derived = await Promise.all(
        secs.map(async (section): Promise<MorningReportSection | null> => {
          let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, section.id);
          if (events.length === 0 && usingSeed) events = DEFAULT_TIMELINE.filter((e) => e.ticketId === section.id);
          const view = assembleTicket(graph, events, section.id);
          return view ? deriveMorningReport(view) : null;
        }),
      );
      if (!active) return;
      setSections(derived.filter((s): s is MorningReportSection => s !== null));
      setLoaded(true);
    })().catch(() => {
      if (active) { setFailed(true); setLoaded(true); }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Visualize · Morning Report"
        title="Morning Report"
        subtitle="The day’s coded record per section — time accounting, code tallies, QC flags, journal, and exceptions. Print-ready."
        actions={
          <button type="button" onClick={() => window.print()} disabled={!loaded || sections.length === 0} className={BTN_CLASS}>
            <Printer className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Print
          </button>
        }
      />
      {!loaded ? (
        <LoadingState />
      ) : failed ? (
        <EmptyState title="Couldn’t load the report" description="The coded-object graph couldn’t be read. Refresh to try again." />
      ) : sections.length > 0 ? (
        <MorningReportView sections={sections} />
      ) : (
        <EmptyState title="No active sections" description="Sections will appear here as they're added to the coded-object graph." />
      )}
    </div>
  );
}
