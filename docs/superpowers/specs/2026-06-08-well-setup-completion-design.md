# Wellbore Completion Enrichment — Design Spec (well-setup slice 2)

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/well-setup-completion`

**Goal:** Enrich the wellbore to the **full suite** with the base features naturally associated with it
that slice 1 lacked — **Tubing, Completions (perforations / packers / SSSV), Cement detail, Wellhead** —
following the pattern that makes the well-setup good: **grouped inputs + graphical output + element
details.** *Group like items for input* (operationally-mirrored sections); render every element on the
schematic; show its details. All standard, generic completion concepts (no proprietary anything).

**Non-goals (later):** artificial lift (ESP/rod/gas-lift detail), screens/sand control specifics, P&A
barriers, multilaterals. Back-compat: all new fields optional; existing saved setups still load.

---

## 1. Core (`packages/core/src/well-setup/`)

Extend `types.ts` (all additive/optional):

```ts
// Cement detail belongs WITH its casing string (grouped) — add to CasingRow:
//   cementSacks?: number; cementLeadPpg?: number; cementTailPpg?: number;   (TOC already exists)

export interface TubingRow {
  odIn: number; idIn: number; weightPpf: number; grade: string; connection: string;
  hangerDepthFt: number; shoeDepthFt: number;
}
export type CompletionType = 'perforation' | 'packer' | 'sssv' | 'screen' | 'sliding_sleeve' | 'gas_lift_mandrel';
export interface CompletionRow {
  id: string; type: CompletionType; name: string;
  topFt: number; bottomFt?: number; shotsPerFt?: number;   // shotsPerFt for perforations
}
export interface WellheadInfo {
  workingPressurePsi?: number; tubingHeadSize?: string; casingHeadSize?: string; treeType?: string;
}
// WellSetup gains: tubing?: TubingRow; completions?: CompletionRow[]; wellhead?: WellheadInfo;
```

`WellboreModel` gains `tubing`, `completions` (sorted by `topFt`), `wellhead` (passed through). The
`COMPLETION_TYPES` list + `COMPLETION_COLUMNS` (for the table) + `TUBING_FIELDS` + `WELLHEAD_FIELDS`
field-spec registries are added (mirroring `CASING_COLUMNS`/`HEADER_FIELDS`). `DEFAULT_WELL_SETUP` is
extended with a tubing string, a few completions (perf interval + a packer + an SSSV), cement detail on
the production casing, and a wellhead — so the enriched diagram is non-trivial on first load.
`projectWellbore` stays pure + back-compat (`?? []` / optional).

## 2. Web

- **Grouped inputs** (in `well-setup-panels.tsx`, new cards/sections — *group like items*):
  - **Casing** table gains cement columns (Sacks, Lead ppg, Tail ppg) — cement grouped with its string.
  - **Tubing** — a single-row group from `TUBING_FIELDS` (OD/ID/weight/grade/connection/hanger/shoe).
  - **Completions** — a repeatable typed table (`COMPLETION_COLUMNS`): type `<select>` (`COMPLETION_TYPES`),
    name, top, bottom, shots/ft; add/remove.
  - **Wellhead** — a small group (`WELLHEAD_FIELDS`): working pressure, tubing-head size, casing-head
    size, tree type.
- **Graphical output** (enrich `wellbore-schematic.tsx`):
  - **Tubing** — an inner vertical string (gold, thinner) from `hangerDepthFt` to `shoeDepthFt` inside the
    innermost casing.
  - **Cement** — shade the cement column from shoe up to TOC on each cemented string (lead/tail hatch).
  - **Completions** — **perforations** as a hatched/zig band on the casing wall over the interval;
    **packer** as a filled bar symbol at depth; **SSSV** as a small valve symbol at depth; others as a
    labeled tick. Each labeled on the right rail.
  - **Wellhead** — a compact wellhead/tree symbol at surface (above MD 0) with a WP rating label.
- **Element details** — the existing per-element annotations extend to the new elements (tubing spec,
  completion type+interval, wellhead WP). The right-rail labels carry the details.

## 3. Files

- Core: extend `well-setup/types.ts`, `field-defs.ts` (new registries + extended `DEFAULT_WELL_SETUP` +
  cement columns), `project-wellbore.ts` (carry tubing/completions/wellhead, sort completions); tests
  (projection carries the new elements; completions sorted; back-compat load without them).
- Web: extend `components/well-setup-panels.tsx` (new grouped sections + cement columns) and
  `components/wellbore-schematic.tsx` (render tubing/cement/completions/wellhead); RTL tests (a
  completion row edits; schematic renders a perforation + tubing + wellhead element).

## 4. Definition of done

Open `/wells/{id}/setup`: grouped input sections for **Tubing, Cement (on casing), Completions,
Wellhead**, and the **wellbore schematic now shows** the tubing string, cement columns, perforations,
packer, SSSV, and a wellhead symbol — with element details — all live, on the mock adapter, exportable
to PNG/print (the export already serializes the SVG). Back-compat: slice-1 saved setups still load.

## 5. Review

Standard pipeline (gates 1–8) + dual-bot PR review with **max adherence**. PR base = `master`.
