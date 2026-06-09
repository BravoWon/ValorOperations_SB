'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import {
  DEFAULT_TEMPLATE_BUNDLES,
  BANK_SEED,
  validateTemplateFieldDefs,
  type TemplateBundle,
} from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TemplateBuilder } from '@/components/template-builder';
import { LoadingState } from '@/components/ui/states';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function TemplateBuilderPage() {
  const [bundles, setBundles] = useState<TemplateBundle[]>(DEFAULT_TEMPLATE_BUNDLES);
  const [bankCodes, setBankCodes] = useState<string[]>(BANK_SEED.map((b) => b.code));
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    Promise.all([getRepo().loadTemplateBundles(), getRepo().loadBankCodes()])
      .then(([storedBundles, storedCodes]) => {
        if (!active) return;
        if (storedBundles) setBundles(storedBundles);
        if (storedCodes) setBankCodes(storedCodes.map((b) => b.code));
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const warnings = useMemo(
    () => validateTemplateFieldDefs(bundles.flatMap((b) => b.fieldDefs)),
    [bundles],
  );

  const onSave = async () => {
    if (!loaded || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await getRepo().saveTemplateBundles(bundles);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2400);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administer · Templates"
        title="Template Builder"
        subtitle="Curate the job/section templates that instantiate Tickets — stages, default Bank codes, and the typed field definitions each template captures."
        actions={
          <button type="button" onClick={onSave} disabled={!loaded || saveState === 'saving'} className={BTN_CLASS}>
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Save'}
          </button>
        }
      />

      {loaded ? (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={`${w}-${i}`} className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateBuilder bundles={bundles} bankCodes={bankCodes} onChange={setBundles} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
