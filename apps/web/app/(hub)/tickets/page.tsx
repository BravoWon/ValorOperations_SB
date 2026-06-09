'use client';

import { useEffect, useState } from 'react';
import {
  assembleTicket,
  objectsByType,
  summarizeTicket,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  type CodedGraph,
  type TimelineEvent,
  type TicketSummary,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { TicketCard } from '@/components/ticket-card';
import { LoadingState, EmptyState } from '@/components/ui/states';

export default function TicketsPage() {
  const [summaries, setSummaries] = useState<TicketSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const repo = getRepo();
      let graph: CodedGraph = await repo.loadCodedGraph(DEMO_ORG_ID);
      let usingSeed = false;
      if (objectsByType(graph, 'section').length === 0) {
        graph = DEFAULT_CODED_GRAPH;
        usingSeed = true;
      }
      const sections = objectsByType(graph, 'section');
      const views = await Promise.all(
        sections.map(async (section) => {
          let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, section.id);
          if (events.length === 0 && usingSeed) {
            events = DEFAULT_TIMELINE.filter((e) => e.ticketId === section.id);
          }
          return assembleTicket(graph, events, section.id);
        }),
      );
      if (!active) return;
      setSummaries(views.filter((v): v is NonNullable<typeof v> => v !== null).map(summarizeTicket));
      setLoaded(true);
    })().catch(() => {
      // Distinguish a load failure from a genuinely empty graph (don't show "no tickets").
      if (active) { setFailed(true); setLoaded(true); }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Operate · Tickets"
        title="Tickets"
        subtitle="Every section of the well as a coded ticket — parties, equipment, and the day's activity timeline. Press ⌘K / Ctrl-K to search the Bank."
      />
      {!loaded ? (
        <LoadingState />
      ) : failed ? (
        <EmptyState title="Couldn’t load tickets" description="The coded-object graph couldn’t be read. Refresh to try again." />
      ) : summaries.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((s) => (
            <TicketCard key={s.id} summary={s} />
          ))}
        </div>
      ) : (
        <EmptyState title="No tickets yet" description="Sections will appear here as they're added to the coded-object graph." />
      )}
    </div>
  );
}
