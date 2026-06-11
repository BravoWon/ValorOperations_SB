import { objectsByType, DEFAULT_CODED_GRAPH } from '@valor/core';
import { TicketTimeView } from '@/components/ticket-time-view';
import { supabaseConfigured } from '@/lib/supabase/config';
import { staticParamsFor } from '@/lib/static-params';

// Pre-render the seed section(s) on static export; the node repo graph is empty, so
// derive the params from the seed constant (matches the board's seed-fallback).
// When Supabase is configured, return [] so the route renders dynamically per request.
export async function generateStaticParams() {
  if (supabaseConfigured()) return [];
  return staticParamsFor(objectsByType(DEFAULT_CODED_GRAPH, 'section').map((s) => ({ ticketId: s.id })));
}

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <TicketTimeView ticketId={ticketId} />;
}
