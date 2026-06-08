# Knowledge-Mining — EDR Config Export + Wellbore Diagram

**Date:** 2026-06-07 · **Sources (abstract only):** one EDR (electronic drilling recorder)
PostgreSQL *config* dump + one wellbore-diagram workbook · **Tool:** targeted schema read +
`openpyxl` structural probe (raw output kept in `%TEMP%`, never committed).

## Method & IP guardrail

We read **table/column structure and generic enumerations**, then abstracted the
**industry-standard layer** below. **Clean-room rule, enforced:** this document contains **no
company, product, vendor, personnel, well, rig, client, lease, permit, or location names**, and **no
proprietary formatting**. The sources carried such data (the diagram's title block held an operator
name, lease/well/permit IDs, county/township, coordinates, and locally-named formations; the EDR
`infotable`/header rows hold operator + crew + well identity). **All of that was discarded** — we
keep only *which fields/channels/units/activities are operationally relevant* and *how a channel
registry is shaped*, which is generic across every EDR and every operator.

What this confirms at the architecture level: the operator's "inputs vary well-to-well" requirement
is met by a **data-driven, user-editable channel/field registry** (typed-EAV `template_field_defs` +
`field_values`) — not hardcoded columns. The EDR proves this pattern in production.

---

## A. Channel registry — the abstract shape (validates `field_defs`)

An EDR stores each measurement channel as a uniform time/depth-indexed series, and keeps **all
human meaning in one editable registry row per channel**. The per-channel storage is trivial
(`{ id, timestamp, depth, value, hidden }`); the registry is where the knowledge lives. Abstracted,
each registry row carries:

| Concept | Field(s) | Notes |
|---|---|---|
| **Identity** | external channel id, **mnemonic**, **description/label** | mnemonic is a short editable code; id is the wire/source channel assignment |
| **Units** | `units` (engineering unit string) | per-channel, editable |
| **Type/precision** | numeric vs text, **decimal places** | display + storage hint |
| **Source/provenance** | `source` (e.g. WITS / LAS / manual / calc), output flags | where the value comes from + whether it re-exports |
| **Calibration** | `bias`, `scale`, `depth offset` | linear correction applied to raw |
| **Range/plot** | min, max, plot scale, line color | display + sanity bounds |
| **Alarms** | high/low thresholds, enable flag — **scoped per role** | same channel, different limits per responsible role |
| **Export mapping** | LAS order, LAS description, LAS filter | how the channel maps into downstream exports |
| **Last-value cache** | last value, last time | latency/health |
| **Audit** | modified timestamp, change log | who/when |

> **Design directive (b.jones, 2026-06-07): the mnemonic AND the channel assignment must be
> user-editable.** This is exactly the EDR model — mnemonic, description, units, source, calibration,
> and alarms are all *config columns the user edits per deployment*, and the registry id is the
> remappable assignment from a wire/source channel to a meaning. Our registry must therefore be a
> first-class **CRUD table** (rename mnemonic, reassign which incoming channel feeds which field,
> edit units/precision/range/alarms), not a fixed schema. This lands in the **Data Manager**
> workspace and is the editable backing for `template_field_defs`.

**Role-scoped alarms** are a notable, reusable idea: one channel can carry different high/low limits
for different responsible roles (operator vs directional vs MWD vs admin). Worth keeping for the
later alerts/《exception》 layer.

## B. Drilling activity / NPT catalog (feeds events + stage activities)

The EDR ships a standard **activity-state catalog** — the same generic operation codes that drive
IADC-style daily reporting and NPT coding. Restated generically (names only; our own one-line gloss):

- **Make hole:** Drilling · Connection · Reaming · Hole Opening · Coring
- **Pipe movement:** Tripping In · Tripping Out · Short Trip In · Short Trip Out
- **Circulation/mud:** Condition / Circulate mud · Flow Check · Lost Circulation
- **Casing/cement:** Run Casing · Cementing · Plug Back · Squeeze Cementing · Wait on Cement ·
  Drill Cement / Float Equipment
- **Pressure/BOP:** Nipple Up / Nipple Down BOP · Test BOP · Pressure Integrity Test (LOT/FIT)
- **Evaluation:** Deviation Survey · Wireline Logs · Drill Stem Test · Directional Work
- **Trouble (NPT):** Rig Repair · Fishing · Stuck Pipe · Well Control · Wait on Weather
- **Service/other:** Rig Up & Tear Down · Lubricate Rig · Cut/Slip Drilling Line · Subsea ·
  Other (free-text) · Auto-select (drilling/connection/tripping)

This is a ready-made **enumeration for the activity-state model** — job/stage **events** can be typed
by activity, and trouble activities (Rig Repair, Fishing, Stuck Pipe, Well Control, Wait on Weather,
Lost Circulation) flag **NPT**. It pairs with our existing `jobs`/`stages`/`events` so a stage's
elapsed time can be attributed to a standard activity, the basis of the "reduce NPT" thesis.

## C. Wellbore / casing / cement condition-state field set

From the wellbore-diagram workbook (one "WBD" sheet) + the EDR `casingtable` schema
(`startdepth, enddepth, casing ID, casing OD`), the generic completion fields:

- **Casing/tubular string** (string role: *Conductor → Surface → Intermediate → Production*): OD (in),
  ID (in), weight (lb/ft / ppf), **grade** (standard API grades, e.g. J-55, L-80), **connection**
  (e.g. 8rd / LTC / BTC), **hole diameter** (in) the string runs in, **set depth** (MD + TVD),
  **top of cement (TOC)**.
- **Cement** per string: **lead** slurry, **tail** slurry, **sacks (sx)**, **density (ppg)**.
- **Formations:** name, **top** (MD/TVD), **bottom** — the formation-tops table.
- **Conductor note pattern:** OD × weight (lb/ft) × length — a compact spec string.

This **enriches the existing condition-state model** (`assets → pads → wells → wellbores →
formations / casing`): add **connection**, **hole diameter**, and **TOC** to the casing entity, and a
**cement** sub-record (lead/tail/sacks/density) per string. Formations already match (name/top/bottom).

## D. Well / job header field set (registry schema, columns only)

The EDR `infotable` (header) abstracts to the generic well + job header — **column names are generic;
the row data is identity/PII and was not read**:

- **Well identity:** API/UWI, well number, permit number.
- **Surface location:** latitude/longitude, grid X/Y + datum (e.g. NAD27), section / township /
  county / state / country, surface hole location.
- **Elevations:** ground level (GL), kelly bushing (KB), derrick floor (DF), subsea reference.
- **Survey refs:** declination, proposed azimuth, north reference, northing/easting.
- **Job:** job number, AFE, start/end date, start/end depth, rig id, rig status, current activity code.
- **Units/time:** depth units, timezone, time offset.
- **Roles (contacts):** operator / company / directional / MWD / geo / admin — name + contact +
  phone + email + shift-start, multiple per role.

## E. How this feeds the build

1. **Data Manager (future workspace)** — an **editable channel/mnemonic registry** is now a named
   capability: CRUD over registry rows (mnemonic, channel assignment, units, precision, range,
   calibration, role-scoped alarms, export mapping). This is the editable backing for
   `template_field_defs` and the ingestion target for EDR/WITS/LAS.
2. **Field Operations (current)** — extend the casing entity (connection, hole diameter, TOC) and add
   a cement sub-record; wire the **activity catalog** into the `events`/NPT typing on stages.
3. **Office Ops (future)** — the header role/contacts set is the seed for the vendor/contacts and
   AFE/cost surfaces.

Provenance + raw-extract handling unchanged from the [pilot](2026-06-07-knowledge-mining-pilot.md):
raw dumps live in `%TEMP%`; only this scrubbed catalog is committed.
