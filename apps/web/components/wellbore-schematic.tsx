'use client';

import { forwardRef, type ReactElement } from 'react';
import type { WellboreModel, CompletionType } from '@valor/core';
import { convertLength, COMPLETION_TYPES, type LengthUnit } from '@valor/core';

// type → display label, derived from the shared registry so the legend stays in sync.
const COMPLETION_LABELS: Record<CompletionType, string> = COMPLETION_TYPES.reduce(
  (acc, t) => {
    acc[t.value] = t.label;
    return acc;
  },
  {} as Record<CompletionType, string>,
);

export interface WellboreSchematicProps {
  model: WellboreModel;
  depthUnit: LengthUnit;
  diaUnit: LengthUnit;
}

// --- Layout constants (print-clean; no glassmorphism inside the SVG) -------
const W = 800; // viewBox width
const H = 1040; // viewBox height
const TITLE_H = 132; // title block height
const AXIS_X = 96; // left depth-axis rail x
const PAD_TOP = 24; // gap below the title block before the wellbore body
const PAD_BOTTOM = 40;
const CENTER_X = AXIS_X + (W - AXIS_X) / 2; // wellbore centerline
const MAX_HALF_WIDTH = 150; // half-width of the widest (outer) casing

// Valor brand tokens, inlined so the export stays self-contained.
const NAVY = '#0D1E35';
const NAVY_PANEL = '#13294B';
const GOLD = '#C9A24B';
const GOLD_LIGHT = '#E3C677';
const CREAM = '#F4EEE1';
const MUTED = '#8FA0B8';
const HOLE_FILL = '#091627';
const CASING_FILL = '#1B355C';
const CEMENT_FILL = '#6B7787'; // neutral grey for the cement annulus
const TUBING_STROKE = '#E3C677'; // gold-light inner string
const STEEL = '#9FB0C8'; // hardware glyphs (packer/valve/wellhead)

function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export const WellboreSchematic = forwardRef<SVGSVGElement, WellboreSchematicProps>(
  function WellboreSchematic({ model, depthUnit, diaUnit }, ref) {
    const { header, casings, holes, formations, totalDepthFt, tubing, completions, wellhead } = model;

    const bodyTop = TITLE_H + PAD_TOP;
    const bodyBottom = H - PAD_BOTTOM;
    const bodyHeight = bodyBottom - bodyTop;

    // Depth scale (px per foot). Guard against totalDepthFt === 0.
    const depthSpanFt = totalDepthFt > 0 ? totalDepthFt : 1;
    const yOf = (ft: number) => bodyTop + (ft / depthSpanFt) * bodyHeight;

    // Casings are already sorted outer→inner (OD desc). Map each to a half-width
    // by OD rank so strings telescope inward concentrically.
    const maxOd = casings.length ? Math.max(...casings.map((c) => c.odIn)) : 1;
    const halfWidthOf = (odIn: number) => {
      const ratio = maxOd > 0 ? odIn / maxOd : 1;
      // Keep a readable minimum so the innermost string is still visible.
      return Math.max(20, MAX_HALF_WIDTH * ratio);
    };

    // Innermost (smallest-OD) casing — completions/tubing live inside it.
    const innerCasing = casings.length ? casings[casings.length - 1] : undefined;
    const innerHalf = innerCasing ? halfWidthOf(innerCasing.odIn) : MAX_HALF_WIDTH * 0.4;
    // Casing wall a given depth sits inside: the deepest string whose shoe is at
    // or below the depth (falls back to the innermost string).
    const wallHalfAt = (ft: number): number => {
      let half = innerHalf;
      for (const c of casings) {
        if (Number.isFinite(c.shoeMdFt) && c.shoeMdFt >= ft) half = halfWidthOf(c.odIn);
      }
      return half;
    };

    // Depth-axis ticks (rounded to a sensible interval).
    const ticks: number[] = [];
    if (totalDepthFt > 0) {
      const target = 8;
      const rawStep = totalDepthFt / target;
      const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const niceStep = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? 10 * mag;
      for (let d = 0; d <= totalDepthFt + 1e-6; d += niceStep) ticks.push(d);
      const last = ticks[ticks.length - 1];
      if (last === undefined || last < totalDepthFt) ticks.push(totalDepthFt);
    }

    const depthLabel = (ft: number) =>
      `${fmt(convertLength(ft, 'ft', depthUnit), depthUnit === 'ft' || depthUnit === 'yd' ? 0 : 1)}`;
    // in/cm → 2 decimals, mm → 1 (so 8.5 in reads 215.9 mm, not 216).
    const diaDecimals = diaUnit === 'mm' ? 1 : 2;
    const diaLabel = (inches: number) =>
      `${fmt(convertLength(inches, 'in', diaUnit), diaDecimals)} ${diaUnit}`;

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Wellbore schematic for ${header.wellName}`}
        style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      >
        <rect x={0} y={0} width={W} height={H} fill={NAVY} />

        {/* -------- Title block (coded header) -------- */}
        <g>
          <rect x={0} y={0} width={W} height={TITLE_H} fill={NAVY_PANEL} />
          <line x1={0} y1={TITLE_H} x2={W} y2={TITLE_H} stroke={GOLD} strokeWidth={1.5} />
          <text x={24} y={34} fill={GOLD} fontSize={13} fontFamily="monospace" letterSpacing={3}>
            WELLBORE SCHEMATIC
          </text>
          <text x={24} y={66} fill={CREAM} fontSize={26} fontWeight={600} fontFamily="serif">
            {header.wellName || 'Untitled Well'}
          </text>
          <text x={24} y={92} fill={GOLD_LIGHT} fontSize={13} fontFamily="monospace">
            {`${header.jobCode} · ${header.codeLabel}`}
          </text>
          {/* right-aligned header facts */}
          <text x={W - 24} y={34} fill={MUTED} fontSize={12} textAnchor="end" fontFamily="monospace">
            {`RIG ${header.rig || '—'}`}
          </text>
          <text x={W - 24} y={56} fill={MUTED} fontSize={12} textAnchor="end" fontFamily="monospace">
            {`SECTION ${(header.section || '—').toUpperCase()}`}
          </text>
          <text x={W - 24} y={78} fill={MUTED} fontSize={12} textAnchor="end" fontFamily="monospace">
            {`DIA ${diaLabel(header.diameterIn)}`}
          </text>
          <text x={W - 24} y={100} fill={MUTED} fontSize={12} textAnchor="end" fontFamily="monospace">
            {`API ${header.wellApi || '—'}`}
          </text>
          <text x={24} y={114} fill={MUTED} fontSize={12} fontFamily="monospace">
            {`STATUS ${header.status}  ·  TD ${depthLabel(totalDepthFt)} ${depthUnit} MD`}
          </text>
        </g>

        {/* -------- Left depth axis -------- */}
        <g>
          <line x1={AXIS_X} y1={bodyTop} x2={AXIS_X} y2={bodyBottom} stroke={GOLD} strokeWidth={1} opacity={0.7} />
          <text
            x={AXIS_X - 6}
            y={bodyTop - 8}
            fill={GOLD}
            fontSize={11}
            textAnchor="end"
            fontFamily="monospace"
            letterSpacing={1.5}
          >
            {`MD (${depthUnit})`}
          </text>
          {ticks.map((d) => {
            const y = yOf(d);
            return (
              <g key={`tick-${d}`}>
                <line x1={AXIS_X - 6} y1={y} x2={AXIS_X} y2={y} stroke={GOLD} strokeWidth={1} opacity={0.7} />
                <line x1={AXIS_X} y1={y} x2={W - 16} y2={y} stroke={MUTED} strokeWidth={0.5} opacity={0.12} />
                <text
                  x={AXIS_X - 10}
                  y={y + 4}
                  fill={MUTED}
                  fontSize={11}
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {depthLabel(d)}
                </text>
              </g>
            );
          })}
        </g>

        {/* -------- Hole channel (open hole below shallowest content) -------- */}
        {totalDepthFt > 0 && (
          <g>
            {holes.length > 0 ? (
              holes.map((h) => {
                const top = yOf(h.topFt);
                const bottom = yOf(h.bottomFt);
                const half = Math.max(16, halfWidthOf(maxOd) * 0.55);
                return (
                  <rect
                    key={`hole-${h.name}-${h.topFt}`}
                    x={CENTER_X - half}
                    y={top}
                    width={half * 2}
                    height={Math.max(0, bottom - top)}
                    fill={HOLE_FILL}
                    stroke={MUTED}
                    strokeWidth={0.75}
                    strokeDasharray="3 3"
                    opacity={0.9}
                  />
                );
              })
            ) : (
              <rect
                x={CENTER_X - 24}
                y={bodyTop}
                width={48}
                height={bodyHeight}
                fill={HOLE_FILL}
                stroke={MUTED}
                strokeWidth={0.75}
                strokeDasharray="3 3"
                opacity={0.9}
              />
            )}
          </g>
        )}

        {/* -------- Casing strings (nested, outer→inner) -------- */}
        {totalDepthFt > 0 && (
          <g>
            {casings.map((c, i) => {
              const half = halfWidthOf(c.odIn);
              const top = bodyTop;
              const shoeY = yOf(c.shoeMdFt);
              const labelY = Math.min(shoeY + 14, bodyBottom - 4);
              return (
                <g key={`casing-${c.role}-${i}`}>
                  {/* left wall */}
                  <line x1={CENTER_X - half} y1={top} x2={CENTER_X - half} y2={shoeY} stroke={GOLD} strokeWidth={2} />
                  {/* right wall */}
                  <line x1={CENTER_X + half} y1={top} x2={CENTER_X + half} y2={shoeY} stroke={GOLD} strokeWidth={2} />
                  {/* tint between walls and the inner string (a thin band hint) */}
                  <rect
                    x={CENTER_X - half}
                    y={top}
                    width={half * 2}
                    height={Math.max(0, shoeY - top)}
                    fill={CASING_FILL}
                    opacity={0.14}
                  />
                  {/* shoe (casing point) — two angled feet */}
                  <path
                    d={`M ${CENTER_X - half} ${shoeY} l -10 14 M ${CENTER_X + half} ${shoeY} l 10 14`}
                    stroke={GOLD_LIGHT}
                    strokeWidth={2.5}
                    fill="none"
                  />
                  {/* shoe depth label, on the right side */}
                  <text
                    x={CENTER_X + half + 16}
                    y={labelY}
                    fill={GOLD_LIGHT}
                    fontSize={11}
                    fontFamily="monospace"
                  >
                    {`${depthLabel(c.shoeMdFt)} ${depthUnit}`}
                  </text>
                  {/* string annotation: role + OD × weight × grade */}
                  <text
                    x={CENTER_X - half - 10}
                    y={labelY}
                    fill={CREAM}
                    fontSize={11}
                    textAnchor="end"
                    fontFamily="sans-serif"
                  >
                    {`${c.role}`}
                  </text>
                  <text
                    x={CENTER_X - half - 10}
                    y={labelY + 14}
                    fill={MUTED}
                    fontSize={10}
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {`${diaLabel(c.odIn)} · ${fmt(c.weightPpf, 1)}# · ${c.grade || '—'} · ${c.connection || '—'}`}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* -------- Cement (annulus shade shoe→TOC where sacks present) -------- */}
        {totalDepthFt > 0 && (
          <g>
            {casings.map((c, i) => {
              const sacks = c.cementSacks;
              if (
                !Number.isFinite(sacks) ||
                (sacks ?? 0) <= 0 ||
                !Number.isFinite(c.tocFt) ||
                !Number.isFinite(c.shoeMdFt) ||
                c.shoeMdFt <= c.tocFt
              ) {
                return null;
              }
              const half = halfWidthOf(c.odIn);
              const outerHalf = i > 0 ? halfWidthOf(casings[i - 1]!.odIn) : Math.min(MAX_HALF_WIDTH, half + 22);
              const topY = yOf(c.tocFt);
              const shoeY = yOf(c.shoeMdFt);
              const bandH = Math.max(0, shoeY - topY);
              const bandW = Math.max(2, outerHalf - half);
              const lead = c.cementLeadPpg;
              const tail = c.cementTailPpg;
              const detail = [
                Number.isFinite(lead) ? `lead ${fmt(lead!, 1)}` : null,
                Number.isFinite(tail) ? `tail ${fmt(tail!, 1)} ppg` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <g key={`cement-${c.role}-${i}`} data-testid="cement">
                  {/* both annulus columns, hatched so it reads as cement, print-clean */}
                  <rect
                    x={CENTER_X - outerHalf}
                    y={topY}
                    width={bandW}
                    height={bandH}
                    fill={CEMENT_FILL}
                    opacity={0.4}
                  />
                  <rect
                    x={CENTER_X + half}
                    y={topY}
                    width={bandW}
                    height={bandH}
                    fill={CEMENT_FILL}
                    opacity={0.4}
                  />
                  {/* TOC tick + label on the right rail */}
                  <line
                    x1={CENTER_X + outerHalf}
                    y1={topY}
                    x2={CENTER_X + outerHalf + 8}
                    y2={topY}
                    stroke={CEMENT_FILL}
                    strokeWidth={1.5}
                  />
                  <text
                    x={CENTER_X + outerHalf + 12}
                    y={topY + 4}
                    fill={MUTED}
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {`cmt ${fmt(sacks!)} sx${detail ? ` · ${detail}` : ''}`}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* -------- Tubing (thin inner production string) -------- */}
        {totalDepthFt > 0 &&
          tubing &&
          Number.isFinite(tubing.hangerDepthFt) &&
          Number.isFinite(tubing.shoeDepthFt) &&
          tubing.shoeDepthFt > tubing.hangerDepthFt && (
            <g data-testid="tubing">
              {(() => {
                const half = Math.max(6, innerHalf * 0.42);
                const topY = yOf(tubing.hangerDepthFt);
                const shoeY = yOf(tubing.shoeDepthFt);
                return (
                  <>
                    {/* double-line string walls */}
                    <line x1={CENTER_X - half} y1={topY} x2={CENTER_X - half} y2={shoeY} stroke={TUBING_STROKE} strokeWidth={1.5} />
                    <line x1={CENTER_X + half} y1={topY} x2={CENTER_X + half} y2={shoeY} stroke={TUBING_STROKE} strokeWidth={1.5} />
                    {/* tubing shoe */}
                    <line x1={CENTER_X - half} y1={shoeY} x2={CENTER_X + half} y2={shoeY} stroke={TUBING_STROKE} strokeWidth={2} />
                    <text
                      x={CENTER_X + half + 6}
                      y={Math.max(topY + 12, bodyTop + 12)}
                      fill={TUBING_STROKE}
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {`TBG ${diaLabel(tubing.odIn)} · ${fmt(tubing.weightPpf, 1)}# · ${tubing.grade || '—'}`}
                    </text>
                  </>
                );
              })()}
            </g>
          )}

        {/* -------- Completions (perforations / packers / SSSV / …) -------- */}
        {totalDepthFt > 0 && (
          <g>
            {completions.map((comp, i) => {
              if (!Number.isFinite(comp.topFt)) return null;
              const topY = yOf(comp.topFt);
              const hasBottom = Number.isFinite(comp.bottomFt) && (comp.bottomFt ?? 0) > comp.topFt;
              const botY = hasBottom ? yOf(comp.bottomFt!) : topY;
              const wall = wallHalfAt(comp.topFt);
              const tbgHalf = Math.max(6, innerHalf * 0.42);
              const interval = hasBottom
                ? `${depthLabel(comp.topFt)}–${depthLabel(comp.bottomFt!)} ${depthUnit}`
                : `${depthLabel(comp.topFt)} ${depthUnit}`;
              const railY = (topY + botY) / 2;

              let glyph: ReactElement;
              if (comp.type === 'perforation') {
                // hatched bands on both casing walls over the interval
                const bandH = Math.max(3, botY - topY);
                const rows = Math.max(3, Math.round(bandH / 6));
                const ticks: ReactElement[] = [];
                for (let r = 0; r < rows; r++) {
                  const y = topY + (bandH * (r + 0.5)) / rows;
                  ticks.push(
                    <g key={`perf-${r}`}>
                      <path d={`M ${CENTER_X - wall - 8} ${y} l 8 -3 M ${CENTER_X - wall - 8} ${y} l 8 3`} stroke={GOLD_LIGHT} strokeWidth={1.5} fill="none" />
                      <path d={`M ${CENTER_X + wall + 8} ${y} l -8 -3 M ${CENTER_X + wall + 8} ${y} l -8 3`} stroke={GOLD_LIGHT} strokeWidth={1.5} fill="none" />
                    </g>,
                  );
                }
                glyph = <>{ticks}</>;
              } else if (comp.type === 'packer') {
                // filled bar across the tubing-casing annulus at top
                glyph = (
                  <>
                    <rect x={CENTER_X - wall} y={topY - 4} width={wall - tbgHalf} height={8} fill={STEEL} />
                    <rect x={CENTER_X + tbgHalf} y={topY - 4} width={wall - tbgHalf} height={8} fill={STEEL} />
                  </>
                );
              } else if (comp.type === 'sssv') {
                // small valve glyph on the tubing at top
                glyph = (
                  <>
                    <rect x={CENTER_X - tbgHalf - 4} y={topY - 6} width={tbgHalf * 2 + 8} height={12} fill={NAVY} stroke={STEEL} strokeWidth={1.5} />
                    <path d={`M ${CENTER_X - tbgHalf} ${topY - 4} L ${CENTER_X + tbgHalf} ${topY + 4} M ${CENTER_X - tbgHalf} ${topY + 4} L ${CENTER_X + tbgHalf} ${topY - 4}`} stroke={STEEL} strokeWidth={1.5} />
                  </>
                );
              } else {
                // generic labeled tick on the right wall
                glyph = (
                  <line x1={CENTER_X + tbgHalf} y1={topY} x2={CENTER_X + wall} y2={topY} stroke={STEEL} strokeWidth={2} />
                );
              }

              return (
                <g key={`completion-${comp.id}-${i}`} data-testid={`completion-${comp.type}`}>
                  {glyph}
                  <line x1={CENTER_X + wall} y1={railY} x2={W - 150} y2={railY} stroke={MUTED} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.4} />
                  <text x={W - 146} y={railY - 3} fill={CREAM} fontSize={10} fontFamily="sans-serif">
                    {comp.name || COMPLETION_LABELS[comp.type]}
                  </text>
                  <text x={W - 146} y={railY + 9} fill={MUTED} fontSize={9} fontFamily="monospace">
                    {`${COMPLETION_LABELS[comp.type]} · ${interval}`}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* -------- Wellhead / tree (stacked-spool glyph above MD 0) -------- */}
        {wellhead && (
          <g data-testid="wellhead">
            {(() => {
              const baseY = bodyTop;
              const cx = CENTER_X;
              const spoolW = Math.max(40, innerHalf * 0.9);
              return (
                <>
                  {/* casing/tubing head spools */}
                  <rect x={cx - spoolW / 2} y={baseY - 18} width={spoolW} height={14} fill={NAVY_PANEL} stroke={STEEL} strokeWidth={1.5} />
                  <rect x={cx - spoolW / 2 + 6} y={baseY - 34} width={spoolW - 12} height={14} fill={NAVY_PANEL} stroke={STEEL} strokeWidth={1.5} />
                  {/* tree cap + wing valves */}
                  <rect x={cx - 8} y={baseY - 50} width={16} height={16} fill={NAVY_PANEL} stroke={STEEL} strokeWidth={1.5} />
                  <line x1={cx - spoolW / 2 + 6} y1={baseY - 27} x2={cx - spoolW / 2 - 6} y2={baseY - 27} stroke={STEEL} strokeWidth={2} />
                  <line x1={cx + spoolW / 2 - 6} y1={baseY - 27} x2={cx + spoolW / 2 + 6} y2={baseY - 27} stroke={STEEL} strokeWidth={2} />
                  <line x1={cx} y1={baseY - 50} x2={cx} y2={baseY - 58} stroke={STEEL} strokeWidth={2} />
                  {Number.isFinite(wellhead.workingPressurePsi) && (wellhead.workingPressurePsi ?? 0) > 0 ? (
                    <text x={cx + spoolW / 2 + 12} y={baseY - 26} fill={STEEL} fontSize={11} fontFamily="monospace">
                      {`WP ${fmt(wellhead.workingPressurePsi!)} psi`}
                    </text>
                  ) : null}
                  {wellhead.treeType ? (
                    <text x={cx - spoolW / 2 - 12} y={baseY - 26} fill={MUTED} fontSize={10} textAnchor="end" fontFamily="sans-serif">
                      {wellhead.treeType}
                    </text>
                  ) : null}
                </>
              );
            })()}
          </g>
        )}

        {/* -------- Formation tops (markers + labels) -------- */}
        {totalDepthFt > 0 && (
          <g>
            {formations.map((f, i) => {
              const y = yOf(f.topFt);
              return (
                <g key={`fm-${f.name}-${i}`}>
                  <line
                    x1={AXIS_X}
                    y1={y}
                    x2={W - 16}
                    y2={y}
                    stroke={GOLD}
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    opacity={0.55}
                  />
                  <text
                    x={W - 20}
                    y={y - 5}
                    fill={GOLD_LIGHT}
                    fontSize={11}
                    textAnchor="end"
                    fontFamily="sans-serif"
                  >
                    {f.name}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* -------- Empty-state hint -------- */}
        {totalDepthFt === 0 && (
          <text
            x={CENTER_X}
            y={(bodyTop + bodyBottom) / 2}
            fill={MUTED}
            fontSize={14}
            textAnchor="middle"
            fontFamily="monospace"
            letterSpacing={1}
          >
            No depths entered yet — add casing, hole, or formation rows.
          </text>
        )}
      </svg>
    );
  },
);
