'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isValidSnapshot } from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/states';
import { LocalDbWorkbench } from '@/components/local-db-workbench';
import { downloadSnapshot, readSnapshotFile } from '@/lib/export-snapshot';
import type { CollectionInfo } from '@valor/core';

export default function LocalDbPage() {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoaded(false);
    getRepo()
      .listCollections()
      .then((cols) => {
        setCollections(cols);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onExport = async () => {
    const snap = await getRepo().exportSnapshot();
    snap.exportedAt = new Date().toISOString();
    downloadSnapshot(snap, `valor-localdb-${Date.now()}.json`);
  };

  const onImport = async (file: File) => {
    setImportError(null);
    try {
      const raw = await readSnapshotFile(file);
      if (!isValidSnapshot(raw)) {
        setImportError('Invalid snapshot file — make sure you export from Valor Operations Hub.');
        return;
      }
      await getRepo().importSnapshot(raw);
      refresh();
    } catch {
      setImportError('Failed to read snapshot file. The file may be corrupted.');
    }
  };

  const onReset = async () => {
    if (!window.confirm('Reset all local data to the seed defaults? This cannot be undone.')) return;
    await getRepo().resetLocalDb();
    refresh();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Local Database"
        title="Local Database"
        subtitle="Browse, export, import, and reset the in-browser data store. Snapshots are portable JSON files that round-trip across devices."
      />

      {importError && (
        <div className="mb-6 flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-4 py-3 text-sm text-red">
          <span>{importError}</span>
        </div>
      )}

      {loaded ? (
        <LocalDbWorkbench
          collections={collections}
          onExport={onExport}
          onImport={onImport}
          onReset={onReset}
        />
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
