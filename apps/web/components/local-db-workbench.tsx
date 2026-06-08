'use client';

import { useRef } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import type { CollectionInfo } from '@valor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Short per-collection description shown in the workbench table. */
const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  dashboards: 'Saved dashboard layouts and widget arrangements',
  wellSetups: 'Per-well tubular and BHA configuration records',
  rigDays: 'Daily rig activity reports and time-accounting blocks',
  channels: 'Channel definitions, mnemonics, units, and alarm limits',
  vendors: 'Approved vendor directory with categories and contact info',
  afe: 'AFE cost lines broken out by category and charge code',
};

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]';

const BTN_DANGER_CLASS =
  'flex items-center gap-1.5 rounded-md border border-red/30 bg-red/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-red transition-colors hover:bg-red/[0.10]';

export interface LocalDbWorkbenchProps {
  collections: CollectionInfo[];
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export function LocalDbWorkbench({
  collections,
  onExport,
  onImport,
  onReset,
}: LocalDbWorkbenchProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      // Reset the input so the same file can be re-selected if needed.
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Collections table */}
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
                    Collection
                  </th>
                  <th className="pb-2 pr-4 text-right font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
                    Count
                  </th>
                  <th className="pb-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {collections.map((col) => (
                  <tr
                    key={col.key}
                    data-testid="collection-row"
                    className="border-t border-white/[0.05]"
                  >
                    <td className="py-2.5 pr-4 font-mono text-xs text-cream">
                      {col.label}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums text-gold-light">
                      {col.count}
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {COLLECTION_DESCRIPTIONS[col.key] ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExport} className={BTN_CLASS} aria-label="Export snapshot">
          <Download className="h-3.5 w-3.5" strokeWidth={2} />
          Export
        </button>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="sr-only"
          aria-label="Select snapshot file"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={handleImportClick}
          className={BTN_CLASS}
          aria-label="Import snapshot"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          Import
        </button>

        <button type="button" onClick={onReset} className={BTN_DANGER_CLASS} aria-label="Reset to seed">
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Reset to seed
        </button>
      </div>
    </div>
  );
}
