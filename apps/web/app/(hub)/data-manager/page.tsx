'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import {
  DEFAULT_CHANNELS,
  validateChannels,
  type ChannelDef,
} from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChannelRegistry } from '@/components/channel-registry';
import { LoadingState } from '@/components/ui/states';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function DataManagerPage() {
  const [channels, setChannels] = useState<ChannelDef[]>(DEFAULT_CHANNELS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load persisted channels on mount (fall back to the default seed).
  useEffect(() => {
    let active = true;
    getRepo()
      .loadChannels()
      .then((stored) => {
        if (!active) return;
        if (stored) setChannels(stored);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const warnings = useMemo(() => validateChannels(channels), [channels]);

  const onSave = async () => {
    setSaveState('saving');
    await getRepo().saveChannels(channels);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Data Manager · Channel Registry"
        title="Channel Registry"
        subtitle="The editable backing for every template field — assign incoming source channels to mnemonics, set units, precision, source, range, and alarms."
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
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red"
                >
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <ChannelRegistry channels={channels} onChange={setChannels} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
