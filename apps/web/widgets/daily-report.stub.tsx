'use client';
import { registerWidget } from '@/lib/widgets/registry';

function DailyReportStub() {
  return <div className="text-sm text-muted-foreground">Daily report — coming soon.</div>;
}

registerWidget(
  { id: 'daily-report', title: 'Daily Report', description: 'Generated daily morning report.', category: 'report', defaultSize: { w: 6, h: 6 } },
  DailyReportStub,
);
export {};
