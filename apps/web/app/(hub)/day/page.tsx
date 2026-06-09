'use client';

import { useEffect, useState } from 'react';
import {
  assembleTicket,
  objectsByType,
  timelineToRigDay,
  deriveTimeAccounting,
  deriveNotifications,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  type CodedGraph,
  type TimelineEvent,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { OperatorsDayBoard, type DayBoardEntry } from '@/components/operators-day-board';
import { LoadingState, EmptyState } from '@/components/ui/states';

export default function OperatorsDayPage() {
  const [rows, setRows] = useState<DayBoardEntry[]>([]);
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
      const entries = await Promise.all(
        sections.map(async (section): Promise<DayBoardEntry | null> => {
          let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, section.id);
          if (events.length === 0 && usingSeed) events = DEFAULT_TIMELINE.filter((e) => e.ticketId === section.id);
          const view = assembleTicket(graph, events, section.id);
          if (!view) return null;
          const day = timelineToRigDay(view);
          // Derive PER SECTION — concatenating blocks across parallel sections would
          // manufacture false overlap warnings.
          return {
            day,
            accounting: deriveTimeAccounting(day.blocks),
            notifications: deriveNotifications(day),
            sectionLabel: day.label,
            href: `/tickets/${day.id}`,
          };
        }),
      );
      if (!active) return;
      setRows(entries.filter((e): e is DayBoardEntry => e !== null));
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
        eyebrow="Visualize · Operator's Day"
        title="Operator's Day"
        subtitle="Every active section's coded day, time-aligned on one 24-hour axis — the operational spine at a glance. Click a row to open its ticket timeline."
      />
      {!loaded ? (
        <LoadingState />
      ) : failed ? (
        <EmptyState title="Couldn't load the day board" description="The coded-object graph couldn't be read. Refresh to try again." />
      ) : rows.length > 0 ? (
        <OperatorsDayBoard rows={rows} />
      ) : (
        <EmptyState title="No active sections" description="Sections will appear here as they're added to the coded-object graph." />
      )}
    </div>
  );
}
