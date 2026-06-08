'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import {
  DEFAULT_VENDORS,
  DEFAULT_AFE,
  summarizeAfe,
  type Vendor,
  type AfeLine,
} from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VendorDirectory } from '@/components/vendor-directory';
import { AfeTable } from '@/components/afe-table';
import { AfeSummaryStrip } from '@/components/afe-summary-strip';
import { LoadingState } from '@/components/ui/states';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function OfficeOpsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(DEFAULT_VENDORS);
  const [afe, setAfe] = useState<AfeLine[]>(DEFAULT_AFE);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load persisted vendors + AFE on mount (fall back to the default seeds).
  useEffect(() => {
    let active = true;
    const repo = getRepo();
    Promise.all([repo.loadVendors(), repo.loadAfe()])
      .then(([storedVendors, storedAfe]) => {
        if (!active) return;
        if (storedVendors) setVendors(storedVendors);
        if (storedAfe) setAfe(storedAfe);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => summarizeAfe(afe), [afe]);

  const onSave = async () => {
    setSaveState('saving');
    const repo = getRepo();
    await Promise.all([repo.saveVendors(vendors), repo.saveAfe(afe)]);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Office Ops · Vendors & Cost"
        title="Office Ops"
        subtitle="Back-office consolidation — a vendors & contacts directory and an AFE/cost table with a live budget-vs-actual rollup."
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
          <Card>
            <CardHeader>
              <CardTitle>Cost Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <AfeSummaryStrip summary={summary} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AFE / Cost Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <AfeTable lines={afe} onChange={setAfe} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendors &amp; Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <VendorDirectory vendors={vendors} onChange={setVendors} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
