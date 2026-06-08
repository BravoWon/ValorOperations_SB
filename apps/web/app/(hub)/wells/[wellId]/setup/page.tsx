'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Download, Printer, Save } from 'lucide-react';
import {
  projectWellbore,
  DEFAULT_WELL_SETUP,
  type WellSetup,
  type LengthUnit,
} from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { WellSetupPanels } from '@/components/well-setup-panels';
import { WellboreSchematic } from '@/components/wellbore-schematic';
import { exportSvgToPng, printDiagram } from '@/lib/export-diagram';

const DEPTH_UNITS: LengthUnit[] = ['ft', 'm', 'yd'];
const DIA_UNITS: LengthUnit[] = ['in', 'mm', 'cm'];

const SELECT_CLASS =
  'rounded-md border border-white/[0.08] bg-background/40 px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider text-cream outline-none transition-colors focus:border-gold/50';
const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function WellSetupPage() {
  const params = useParams<{ wellId: string }>();
  const wellId = params?.wellId ?? 'unknown';

  const [setup, setSetup] = useState<WellSetup>(DEFAULT_WELL_SETUP);
  const [depthUnit, setDepthUnit] = useState<LengthUnit>('ft');
  const [diaUnit, setDiaUnit] = useState<LengthUnit>('in');
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const svgRef = useRef<SVGSVGElement>(null);

  // Load persisted setup on mount (fall back to the default seed).
  useEffect(() => {
    let active = true;
    getRepo()
      .loadWellSetup(wellId)
      .then((stored) => {
        if (!active) return;
        if (stored) setSetup(stored);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [wellId]);

  const model = useMemo(() => projectWellbore(setup), [setup]);

  const onSave = async () => {
    setSaveState('saving');
    await getRepo().saveWellSetup(wellId, setup);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  const onExportPng = () => {
    if (svgRef.current) {
      const name = `wellbore_${(setup.header.section || 'section').toLowerCase()}_${setup.header.status}.png`;
      void exportSvgToPng(svgRef.current, name);
    }
  };

  return (
    <div>
      <style>{`@media print {
        .no-print { display: none !important; }
        .print-full { width: 100% !important; position: static !important; }
      }`}</style>

      <PageHeader
        eyebrow="Field Operations · Well Setup"
        title={setup.header.wellName || 'Well Setup'}
        subtitle="Coded well-setup inputs projected live to an export-ready wellbore schematic."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-wider text-muted-foreground/70">
              <span className="font-mono">Depth</span>
              <select
                aria-label="Depth unit"
                value={depthUnit}
                onChange={(e) => setDepthUnit(e.target.value as LengthUnit)}
                className={SELECT_CLASS}
              >
                {DEPTH_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-wider text-muted-foreground/70">
              <span className="font-mono">Dia</span>
              <select
                aria-label="Diameter unit"
                value={diaUnit}
                onChange={(e) => setDiaUnit(e.target.value as LengthUnit)}
                className={SELECT_CLASS}
              >
                {DIA_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onSave} disabled={saveState === 'saving'} className={BTN_CLASS}>
              <Save className="h-3.5 w-3.5" strokeWidth={2} />
              {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onExportPng} className={BTN_CLASS}>
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Export PNG
            </button>
            <button type="button" onClick={() => printDiagram()} className={BTN_CLASS}>
              <Printer className="h-3.5 w-3.5" strokeWidth={2} />
              Print / PDF
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        {/* Left: registry-driven inputs (hidden on print) */}
        <div className="no-print min-w-0">
          {loaded ? (
            <WellSetupPanels
              setup={setup}
              onChange={setSetup}
              depthUnit={depthUnit}
              diaUnit={diaUnit}
            />
          ) : null}
        </div>

        {/* Right: live, export-ready diagram (sticky) */}
        <div className="print-full min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-gold/15">
            <WellboreSchematic ref={svgRef} model={model} depthUnit={depthUnit} diaUnit={diaUnit} />
          </div>

          {model.warnings.length > 0 && (
            <ul className="no-print mt-4 space-y-1.5">
              {model.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
