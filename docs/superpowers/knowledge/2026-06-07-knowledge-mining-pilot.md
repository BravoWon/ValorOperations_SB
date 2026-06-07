# Knowledge-Mining Pilot — Results

**Date:** 2026-06-07 · **Scope:** bounded pilot (DD calculation spreadsheets + morning-report
templates) · **Tool:** `tools/knowledge-mining/extract.py`

## Method & IP guardrail

The extractor harvested **cell labels, units, and structure** from 28 spreadsheets (27 read; one
legacy `.xls` was unreadable by `xlrd` and skipped). From that we abstracted the **generic,
industry-standard layer** below.

**Clean-room rule, enforced:** this document contains **no company, product, personnel, well, rig,
client, or location names**, and **no proprietary cell formulas**. Source files contained such data
(e.g., a morning report held live client/rig/well/crew/coordinates) — all of it was **discarded**.
The formulas here are standard, publicly-documented oilfield math, restated independently. What we
keep is *which variables/units/structures are operationally relevant* — the fuel for the
panels→fields→compute→DB substrate.

## A. Units catalog (observed across the slice)

| Unit | Meaning | Used for |
|---|---|---|
| `ft` / `feet` | feet | depths (MD/TVD), lengths, intervals |
| `in` | inches | hole / pipe / casing diameters |
| `ppg` | lb/gal | mud weight, equivalent mud weights |
| `psi` | pressure | SIDPP, SICP, surface pressures |
| `psi/ft` | pressure gradient | fracture gradient, mud gradient |
| `bbl` / `bbls` | barrels | volumes (annular, string, circulating) |
| `bpf` | bbl per foot | tubular/annular capacity |
| `gal` / `gpm` | gallons / per min | pump output, flow rate |
| `spm` | strokes/min | pump speed |
| `bbl/stk` | bbl per stroke | pump output |
| `ft/hr` | feet/hour | rate of penetration (ROP) |
| `ft/min` (fpm) | feet/min | annular velocity |
| `lb/ft` / `ppf` | weight per foot | tubular weight |
| `klbf` / `lbf` | force | hook load, overpull |
| `rpm` | rev/min | rotary / motor speed |
| `deg` / `°/100ft` | degrees / dogleg | inclination, azimuth, dogleg severity, build/turn rate |
| `sks` (sx) | sacks | cement |
| `%` | percent | pump efficiency, washout |

## B. Variable catalog by domain (generic)

> Formulas are standard field equations (restated). Symbols: `D`=diameter(in), `ID/OD`=inner/outer
> dia(in), `L`=length(ft), `TVD`/`MD`=true-vertical/measured depth(ft), `MW`=mud weight(ppg).

### B1. Hydraulics & circulation
- **Annular capacity** `C_ann` (bbl/ft) = `(D_hole² − D_pipe²) / 1029.4`
- **Pipe internal capacity** `C_pipe` (bbl/ft) = `ID² / 1029.4`
- **Pipe displacement** (bbl/ft) = `(OD² − ID²) / 1029.4`
- **Annular volume** (bbl) = `C_ann × L`
- **Pump output** (bbl/stk, triplex single-acting) = `0.000243 × ID_liner² × stroke_len × eff`
  (eff as a fraction); **gal/stk** = `bbl/stk × 42`
- **Flow rate** `Q` (gpm) = `bbl/stk × 42 × SPM`; (bbl/min) = `bbl/stk × SPM`
- **Bottoms-up strokes** = `annular_volume / (bbl/stk)`; **bottoms-up time** (min) = `strokes / SPM`
- **Total circulating strokes/volume** = string + annular volume ÷ pump output
- **Annular velocity** `AV` (ft/min) = `24.5 × Q(gpm) / (D_hole² − D_pipe²)`

### B2. Well control
- **Hydrostatic pressure** (psi) = `0.052 × MW × TVD`
- **Kill mud weight** `KMW` (ppg) = `MW + SIDPP / (0.052 × TVD)`
- **Initial circ. pressure** `ICP` = `SIDPP + SCRP`; **Final circ. pressure** `FCP` = `SCRP × KMW / MW`
- **Fracture gradient** (psi/ft) and **LOT/FIT** equivalent mud weight (ppg)
- **MAASP** (psi) = `(LOT_EMW − MW) × 0.052 × shoe_TVD`
- Tracked inputs: `SIDPP`, `SICP`, `pit gain`, `LOTMW`, `frac. grad`, `shoe TVD`, `bit TVD`

### B3. Directional & survey
- **Inclination** (deg), **azimuth** (deg), **MD/TVD** (ft), **vertical section** (ft)
- **Dogleg severity** / **build rate** / **turn rate** (°/100ft) via the **minimum-curvature** method
- **Toolface / lead angle** (deg) for steering; **build prediction** (°/100ft) over an interval
- Projections: MD→TVD and to-the-bit projections along planned sections

### B4. Tubular mechanics
- **Pipe stretch** (in) = `(overpull_lbf × L) / (A_steel × E)` (E≈30×10⁶ psi; A from pipe wall area)
- **Free-point depth** (ft) ≈ stretch-based free-point-constant method
- **Total flow area** `TFA` (in²) = `Σ (π/4 × nozzle_dia²)` over bit nozzles
- **Overpull** (klbf) margins vs. pipe tensile rating

## C. Report field-structure catalog (generic Daily Morning Report)

Abstracted field groups (labels only — no data):
- **Header:** client, job number, rig, well name, state, county, lat/long, distribution list, date.
- **Past 24 hours:** footage, out-of-service?, POOH?, reason, hours drilled, hours NPT, daily-KPI-met?, average ROP, comments.
- **Current ops & 24-hr forecast:** operational status, section, depth, section TD, run/BHA #, hole size, services, forecast narrative.
- **Personnel:** DD (days/nights), MWD (days/nights).
- **Failure summary:** run/BHA #, section, failed component(s), out-of-service?, comments.
- **KPI summary:** section, hole size, date-in (planned/actual), depth-in, date-out (planned/actual), depth-out.
- **Inventory / logistics:** rig inventory, BOL, manifest, shipping instructions, email-format export.

## D. Derived module candidates (mapped to the substrate)

Each maps directly to **template field-defs (inputs) → a pure compute method (outputs) → DB**.

### D1. Hydraulics & Circulation panel  ⟵ FIRST candidate to build
A clean, self-contained demonstration of the engine. Proposed shape:

**Inputs** (`template_field_defs`, number unless noted; with unit + range):
`hole_diameter` (in, 3–36), `pipe_od` (in, 1–10), `pipe_id` (in, 0.5–9), `casing_id` (in, opt),
`measured_depth` (ft, 0–40000), `mud_weight` (ppg, 7–20), `pump_liner_id` (in, 3–8),
`pump_stroke_length` (in, 6–18), `pump_efficiency` (%, 50–100), `spm` (spm, 0–200).

**Compute method** `computeHydraulics(inputs)` → outputs:
`annular_capacity` (bbl/ft), `pipe_capacity` (bbl/ft), `annular_volume` (bbl),
`pump_output` (bbl/stk), `flow_rate` (gpm), `bottoms_up_strokes`, `bottoms_up_time` (min),
`annular_velocity` (ft/min), `hydrostatic_pressure` (psi) — all from §B1/§B2 formulas.

Home: a pure, TDD-tested function in `packages/core/src/compute/hydraulics.ts` (mirrors the existing
`validation.ts`/`transitions.ts` style); rendered as a panel whose fields are registry-driven.

### D2. Daily Morning Report panel
The §C field-structure as a job-scoped template (field-defs grouped by section) → a generated
report view + (later) the O365 "Email Format" export.

### D3. Survey / Projection panel
Minimum-curvature MD↔TVD, dogleg severity, build/turn — inputs (inc, azi, MD) → computed track.

### D4. Tubular / Stuck-pipe panel
Stretch, free-point, TFA, overpull margin.

## How this feeds the build
The catalog *is* the content for new modules: each variable → a `field_def` (with unit + range);
each formula → a `compute method`; §C → a report template. The next step is to green-light building
**D1 (Hydraulics & Circulation)** as a small plan on the existing substrate, then optionally scale
the scan to the full archive (a gated, multi-agent run) to grow the catalog and the module backlog.
