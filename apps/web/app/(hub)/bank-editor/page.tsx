'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { BANK_SEED, validateBankCodes, type BankCode } from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BankRegistry } from '@/components/bank-registry';
import { LoadingState } from '@/components/ui/states';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function BankEditorPage() {
  const [codes, setCodes] = useState<BankCode[]>(BANK_SEED);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    let active = true;
    getRepo()
      .loadBankCodes()
      .then((stored) => {
        if (!active) return;
        if (stored) setCodes(stored);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const warnings = useMemo(() => validateBankCodes(codes), [codes]);

  const onSave = async () => {
    setSaveState('saving');
    try {
      await getRepo().saveBankCodes(codes);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
    } catch {
      // Don't leave the button stuck on "Saving…" if persistence fails.
      setSaveState('idle');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administer · The Bank"
        title="Bank Editor"
        subtitle="The editable activity-code catalog every plane consumes — set each code's label, category, NPT flag, and billable flag."
        actions={
          <button type="button" onClick={onSave} disabled={saveState === 'saving'} className={BTN_CLASS}>
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        }
      />

      {loaded ? (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <BankRegistry codes={codes} onChange={setCodes} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
