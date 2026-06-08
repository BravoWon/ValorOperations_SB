'use client';

import { useState } from 'react';
import { Check, Flag, RotateCcw, X } from 'lucide-react';
import {
  findBankCode,
  findLikeItems,
  type QcMark,
  type RecallItem,
  type TimeBlock,
} from '@valor/core';

export interface RecallDrawerProps {
  block: TimeBlock | null;
  onReuse: (item: RecallItem) => void;
  onQc: (mark: QcMark | undefined) => void;
  onClose: () => void;
}

const QC_BTN =
  'flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors';
const REUSE_BTN =
  'ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]';

function hMM(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
}

function depthSpan(item: RecallItem): string | null {
  if (!Number.isFinite(item.depthStartFt) && !Number.isFinite(item.depthEndFt)) return null;
  const start = item.depthStartFt?.toLocaleString() ?? '—';
  const end = item.depthEndFt?.toLocaleString() ?? '—';
  return `${start}→${end} ft`;
}

/**
 * Recall & QC pull-up: a fixed bottom drawer for the selected block. Surfaces
 * like-items (same coded activity from other days/wells) for one-tap reuse
 * (copy-forward depth/note) and QC (approve / flag + note). Renders nothing when
 * no block is selected. All updates flow up via callbacks; the page persists.
 */
export function RecallDrawer({ block, onReuse, onQc, onClose }: RecallDrawerProps) {
  const [note, setNote] = useState('');

  if (!block) return null;

  const codeLabel = findBankCode(block.code)?.label ?? 'Unknown code';
  const likeItems = findLikeItems(block.code);
  const trimmedNote = note.trim();
  const qc = block.qc;

  const mark = (status: QcMark['status']) => {
    onQc(trimmedNote ? { status, note: trimmedNote } : { status });
  };

  return (
    <div
      data-testid="recall-drawer"
      className="glass-strong fixed inset-x-0 bottom-0 z-40 border-t border-gold/20"
      role="region"
      aria-label="Recall and QC"
    >
      <div className="page-container max-h-[60vh] overflow-y-auto px-4 py-4 sm:px-6">
        {/* Header: selected block + close */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="eyebrow">Recall &amp; QC</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-medium text-gold-light">{block.code}</span>
            <span className="text-sm text-muted-foreground">{codeLabel}</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground/80">
            {`${hMM(block.startMin)}–${hMM(block.endMin)} · ${hMM(block.endMin - block.startMin)}`}
          </span>
          {qc && (
            <span
              className={
                qc.status === 'approved'
                  ? 'inline-flex items-center gap-1 rounded-sm border border-green/40 bg-green/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-green'
                  : 'inline-flex items-center gap-1 rounded-sm border border-red/40 bg-red/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-red'
              }
            >
              {qc.status === 'approved' ? (
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Flag className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
              )}
              {qc.status}
            </span>
          )}
          <button
            type="button"
            aria-label="Close recall drawer"
            onClick={onClose}
            className="ml-auto rounded-md border border-white/[0.08] p-1.5 text-muted-foreground/60 transition-colors hover:border-gold/40 hover:text-gold-light"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* QC controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => mark('approved')}
            className={`${QC_BTN} border-green/30 bg-green/[0.06] text-green hover:bg-green/[0.12]`}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Approve
          </button>
          <button
            type="button"
            onClick={() => mark('flagged')}
            className={`${QC_BTN} border-red/30 bg-red/[0.06] text-red hover:bg-red/[0.12]`}
          >
            <Flag className="h-3.5 w-3.5" strokeWidth={2.5} />
            Flag
          </button>
          <input
            aria-label="QC note"
            type="text"
            value={note}
            placeholder="QC note (optional)"
            onChange={(e) => setNote(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1.5 text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60"
          />
          <button
            type="button"
            onClick={() => onQc(undefined)}
            className={`${QC_BTN} border-white/[0.08] text-muted-foreground/70 hover:border-gold/40 hover:text-gold-light`}
          >
            Clear QC
          </button>
        </div>

        {/* Like-items list */}
        <div className="mt-5 space-y-1.5">
          <div className="eyebrow">{`Like Items · ${likeItems.length}`}</div>
          {likeItems.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground/50">
              No prior {block.code} activity to recall.
            </p>
          ) : (
            likeItems.map((item) => {
              const depth = depthSpan(item);
              return (
                <div
                  key={item.id}
                  data-testid="like-item"
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-white/[0.05] bg-white/[0.012] px-2.5 py-2"
                >
                  <span className="font-mono text-xs font-semibold text-cream/90">
                    {`${item.wellLabel} · ${item.dayLabel}`}
                  </span>
                  <span className="font-mono text-[0.6875rem] text-muted-foreground/70">
                    {`${hMM(item.startMin)}–${hMM(item.endMin)}`}
                  </span>
                  {depth && (
                    <span className="font-mono text-[0.6875rem] text-muted-foreground/70">
                      {depth}
                    </span>
                  )}
                  {item.note && (
                    <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-muted-foreground/60">
                      {item.note}
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid="reuse-btn"
                    aria-label={`Reuse ${item.wellLabel} ${item.dayLabel}`}
                    onClick={() => onReuse(item)}
                    className={REUSE_BTN}
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Reuse
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
