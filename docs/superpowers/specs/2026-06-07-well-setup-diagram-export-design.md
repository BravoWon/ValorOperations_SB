# Well Setup → Live Wellbore Diagram → Export — Design Spec

**Status:** draft for b.jones review · **Date:** 2026-06-07 · **Phase:** Field Operations, build slice 1

**Goal:** Define **coded, fully customizable well-setup input items** and render them **live** into an
**export-formatted wellbore schematic** (PDF / PNG / print) — the first visible slice of the hub's
"panels → fields → compute/visualize → DB → back" engine, and the proof that the system *generates*
the wellbore-diagram document from structured data instead of hand-drawing it.

**Non-goals (later slices):** BHA & trajectory diagrams, the Rig Day timeline console, the live EDR
auto-feed, the real Supabase backend + REST API, and heavy PDF-engine polish. This slice runs
**frontend-first on the mock adapter**, but every seam is shaped for those.

---

## 1. Architecture

```
 Input Panels            Pure projection          Visualization         Export
 (registry-driven)  ─▶   projectWellbore()  ─▶   <WellboreSchematic/> ─▶  PNG / PDF / print
   field_defs             (packages/core)          SVG, depth-scaled       + data sheet
   field_values  ◀── repository seam (mock/localStorage now, Supabase later) ──┘
```

- **Inputs** are `template_field_defs` (typed-EAV) grouped into setup sections; every field carries
  `customizable: true` and is rendered by a registry-driven panel (same substrate as the hydraulics
  panel). No bespoke per-field code.
- **Projection** is a pure function `projectWellbore(values) → WellboreModel` in `@valor/core`
  (mirrors `computeHydraulics` style): deterministic, unit-aware, TDD-tested, no React.
- **Visualization** is an `<WellboreSchematic model={…}/>` SVG component — depth-scaled, print-clean.
- **Export** serializes the SVG to **PNG** (canvas) and to a **print/PDF** layout (a title block with
  the coded header + the schematic + a values data sheet), via a brand-free, generic template.
- **Persistence** flows only through the `Repository` interface: `saveWellSetup` / `loadWellSetup` /
  `recallWellSetup` (copy-forward). Mock/localStorage now; the same contract is the future API.

## 2. The coded header (medical-coding structure)

Every setup is owned by a **coded Section/Job object** (the future timeline row). *(The "operator
console" feel is inspired by support-desk software as a **mental model only** — this is a purpose-built,
superior product, **not** an integration with any such tool.)*

| Field | Type | Notes |
|---|---|---|
| `job_code` | code (FK → Bank) | **selected from the code catalog**; drives roll-up/AFE/NPT |
| `well_api` (UWI) | string | jurisdiction-agnostic identifier field |
| `rig` | string | |
| `well_name` | string | |
| `section_name` | enum (extensible) | Conductor / Surface / Intermediate / Production / … |
| `diameter` | number (in) | hole/section diameter |
| `planned_start` / `planned_stop` | datetime | |
| `actual_start` / `actual_stop` | datetime | |
| `status` | enum | `planned` · `in_progress` · `complete` |

**The Bank (code catalog)** is a seeded, **editable** lookup: `{ code, label, category, npt: bool,
billable: bool }`, seeded from the mined activity catalog (its native numeric codes ‑99…34). A field
of type `code` renders as a searchable picker over the Bank (the ⌘K "search the bank" interaction).

## 3. Input items (slice-1 subset of the 139-field catalog)

Grouped `field_defs` (full attributes live in `dd-catalog.scrubbed.json`):

- **Section/Job header** — the coded header above.
- **Hole sections** (repeatable): name, bit diameter (in), top/bottom depth (MD).
- **Casing / liner strings** (repeatable, role-ordered Conductor→Production): OD (in), ID (in),
  weight (lb/ft), grade (API 5CT, e.g. J-55/L-80), connection, set depth (MD + TVD), TOC.
- **Cement** (per string): lead slurry, tail slurry, sacks (sx), density (ppg).
- **Formation tops** (repeatable): name, top (MD/TVD), bottom.

Every group is customizable (add/rename/retype/reorder fields via the editable registry).

## 4. WellboreModel (projection output)

```ts
interface WellboreModel {
  header: { jobCode: string; codeLabel: string; wellApi: string; rig: string;
            wellName: string; section: string; diameter: number; status: string };
  totalDepth: number;                       // max set/section depth, for scaling
  holeSections: { name: string; bitDia: number; top: number; bottom: number }[];
  casings: { role: string; od: number; id: number; weight: number; grade: string;
             connection: string; shoeMd: number; shoeTvd: number; toc: number | null }[];
  cement: { stringRole: string; lead: string; tail: string; sacks: number; ppg: number }[];
  formations: { name: string; top: number; bottom: number | null }[];
  warnings: string[];                       // e.g. shoe deeper than section TD, missing TVD
}
```

`projectWellbore` normalizes/sorts by depth, derives capacities where useful, and emits `warnings`
(non-throwing) — the same defensive sanitize pattern as `computeHydraulics`.

## 5. Diagram (`<WellboreSchematic/>`)

A vertical, **depth-scaled** SVG:
- Casing strings drawn as **nested** vertical pairs by OD (widest = conductor outward), each ending at
  its **shoe** with a depth label; concentric strings telescope inward.
- **Hole sections** as the open-hole channel below each shoe.
- **Cement** columns shaded between casing and hole from shoe up to **TOC** (lead/tail hatching).
- **Formation tops** as labeled horizontal markers at their MD on a depth axis (left rail: MD/TVD).
- **Labels**: each string annotated OD × weight × grade × connection × shoe depth; a **title block**
  with the coded header (job_code + label, well, rig, section, diameter, status).
- Valor brand tokens; print-clean (no glassmorphism in the export layout).

## 6. Export

- **PNG** — serialize the live SVG → canvas → `toBlob` download.
- **PDF / print** — a dedicated `@media print` export layout (title block + schematic + values data
  sheet); "Save as PDF" via the browser print path for slice 1 (a true PDF lib is a later polish).
- **Data sheet** — the structured field values as a table, exported alongside.
- **Filenames** — generic token convention `wellbore_{section}_{status}_{date}` (no brand/identity).

## 7. Persistence (repository seam)

Add to the `Repository` interface (mock adapter implements via localStorage now):
`saveWellSetup(wellId, values)`, `loadWellSetup(wellId)`, `recallWellSetup(fromWellId) → values`
(copy-forward with a per-field `recall_policy`: carry-forward | zero | reset-draft). Values are
versioned + actor/timestamp-stamped. This is the exact `save/load/push/recall` contract the Supabase
adapter + REST API implement later (push/publish = a later slice).

## 8. Units & flipping (imperial ⇄ metric, integrated)

- **Canonical storage:** every numeric is stored **once in a fixed canonical unit per quantity** and
  converted only for display. For **slice 1** the length canon is **imperial base** — inches for
  diameters, feet for depths (`diameterIn`, `shoeMdFt`, …) — and the `units` module converts through SI
  (meters) internally. Each `field_def` carries a `unit_quantity` (length, …), so moving the canon to
  SI later is a localized change.
- **Per-quantity unit menus:** length flips across **mm · cm · in · ft · yd · m**; each other quantity
  exposes its standard set. A global **Imperial ⇄ Metric** switch sets per-quantity defaults; any field
  can override locally (e.g. depths in ft while a bit diameter shows in mm).
- **Live, lossless conversion:** flipping a unit re-renders the value **and** re-labels the diagram's
  depth axis + annotations instantly, converting from the stored canonical unit — no stored-data mutation, no
  rounding drift (round only on display via the field's precision).
- **Integrated calc:** `projectWellbore` and all compute run in canonical units, so capacities,
  geometry, and the schematic stay correct regardless of the displayed unit.
- **Provenance on export:** the chosen display unit (+ conversion factor) travels with the data sheet,
  matching the future API's unit-negotiation contract.

A small `@valor/core` `units` module (`convertLength` through canonical meters + per-quantity unit
sets) is the single source of truth, TDD-tested, shared by panels, diagram, and export.

## 9. Files

- `packages/core/src/well-setup/field-defs.ts` — grouped, customizable `field_defs` (slice-1 subset).
- `packages/core/src/well-setup/bank.ts` — code-catalog (Bank) types + seed from the activity codes.
- `packages/core/src/well-setup/project-wellbore.ts` — `projectWellbore()` + `WellboreModel`.
- `packages/core/src/well-setup/*.test.ts` — projection + bank + recall unit tests (TDD).
- `apps/web/components/wellbore-schematic.tsx` — the SVG diagram.
- `apps/web/components/well-setup-panels.tsx` — registry-driven input panels + Bank code picker.
- `apps/web/lib/export-diagram.ts` — PNG/print/data-sheet export utils.
- `apps/web/app/wells/[wellId]/setup/page.tsx` — the slice-1 screen (panels + live diagram + export).
- repo seam additions in `packages/core/src/repository.ts` + `mock-repository.ts`.

## 10. Testing

- **Core (Vitest):** `projectWellbore` — nesting/sort, TOC/shoe geometry, warnings on bad input;
  Bank seed integrity (unique codes, NPT/billable flags); `recall` copy-forward policies.
- **Web (RTL + jsdom):** panels render registry fields; editing a field updates the model; the
  schematic renders expected `<rect>/<line>/<text>` for a seed well; export util produces a blob.
- Follows the repo review pipeline (gates 1–8) with a test-after-resolution pass.

## 11. Definition of done

Open `/wells/{id}/setup`, edit coded well-setup inputs and **watch the wellbore schematic update live**; **flip units (in ⇄ mm ⇄ ft ⇄ m) and see values + the diagram convert instantly**,
and **export a print/PDF + PNG + data sheet** — all on the mock adapter, in the Valor brand, viewable
on the live link. Seams (Bank editability, recall policy, repository, export template) shaped for the
later API + backend without rework.
