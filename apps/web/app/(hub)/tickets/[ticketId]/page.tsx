import { objectsByType, DEFAULT_CODED_GRAPH } from '@valor/core';
import { TicketTimeView } from '@/components/ticket-time-view';

// Pre-render the seed section(s) on static export; the node repo graph is empty, so
// derive the params from the seed constant (matches the board's seed-fallback).
export async function generateStaticParams() {
  if (process.env.STATIC_EXPORT !== 'true') return [];
  return objectsByType(DEFAULT_CODED_GRAPH, 'section').map((s) => ({ ticketId: s.id }));
}

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <TicketTimeView ticketId={ticketId} />;
}
