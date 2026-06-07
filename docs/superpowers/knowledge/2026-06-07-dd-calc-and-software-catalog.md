# Knowledge-Mining — DD Calc Archive + World-Class DD Software (Investigation Loop)

**Date:** 2026-06-07 · **Method:** a 32-agent investigation **Workflow** (`dd-calc-investigation`)
over 24 directional-drilling calc sheets + 2 world-class DD-software docs (release notes + a 73k-char
data-management guide) + 3 daily-report templates + a tubular technical data book. Each source was
abstracted by **value × context × intent**, then synthesized and **adversarially IP-audited**.
Structured output: [`dd-catalog.scrubbed.json`](dd-catalog.scrubbed.json) (139 fields · 23-module
backlog · 24 module specs · 16 API points · 12 persistence points).

## IP guardrail — audited clean

The adversarial audit returned **`ip_clean: true`**: zero company/product/vendor/well/lease/field/
rig/personnel/location names and **no PII/coordinate/serial values** anywhere. It correctly cleared
**open public standards** as non-proprietary (API 5CT casing grades H-40…Q-125, API connection
designations, ISCWSA tool-error classes, IGRF geomagnetic model, WGS-84, the WITSML interoperability
envelope, UN3090/UN3091 battery codes, OAuth2). The **one** soft token — vendor-derived viscometer
shorthand — was generalized to **"300-RPM / 600-RPM viscometer dial readings (per API RP 13B)."** All
math is referenced by standard name only (min-curvature, radius-of-curvature, buoyancy factor, TFA,
KWM/ICP/FCP, MASICP = derate × burst, free-point stretch, DLS). Raw extracts stay in `%TEMP%`.

## A. Customizable well-setup field catalog — 139 fields, ~45 groups

The full set is in the JSON; the **groups** (each becomes a `template_field_defs` group, every field
user-customizable):

- **Condition-state — identity & location:** Location Hierarchy (12), Surface Datum & Reference (4),
  Coordinate Reference System (6), Geomagnetics (3), Lease Lines/Boundaries (1), Unit System &
  Provenance (2), Access Control (1).
- **Condition-state — geometry & tubulars:** Wellbore Geometry hole/casing/liner (8), Tubing (3),
  BHA Mechanical/Nozzles/Sensors (6+1+2), Cement (1), Buoyancy & Tubular Mechanics (1), Pipe
  Tally/Tripping (1), Temperature (1), Tanks/Pits (1).
- **Activity-state — trajectory & steering:** Trajectory/Survey Station (12), Survey Quality &
  Uncertainty (5), Target/Landing Zone (5), Well Plan/Proposal (2), Steering/Execution (2),
  Risks & Events (2).
- **Activity-state — drilling & well control:** Drilling Parameters (hydraulics/torque-drag/
  vibration/sag, 4+3+2+1), Pump (4), Mud/Fluid Properties (6), Pressure & Gradients (4), Well
  Control kill-sheet/formation-tests/subsea (7+2+1), BOP/Accumulator (4), Stuck Pipe/Fishing (2).
- **Reporting (Daily Morning Report):** Job Identity, Personnel, 24-hr Performance (5), KPI, Failure
  Tracking, Inventory/Tool Register, Dangerous Goods, Logistics/BOL (2), Metadata (2).

## B. DD calc module backlog — 23 modules (registry-driven panels)

Each maps to the proven **field-defs → pure compute method → DB** shape (the existing
`computeHydraulics` is the template). **High** priority first:

| Pri | Domain | Module |
|---|---|---|
| high | directional | Minimum-Curvature Survey Engine · Build-to-Target Landing · Survey/Trajectory Formula Pack · Horizontal Build-Up & Steering · Projection-to-Bit / to-Polygon-Target · Toolface/Ouija Solver · Dogleg Decomposition (build vs turn) · Motor Build-Rate Predictor |
| high | hydraulics | Bottoms-Up Strokes & Volume (depth-table) · Mud Pump Output · Bit Hydraulics Optimizer (TFA / nozzle sizing) |
| high | well control | Wellbore Volumetrics + Kill Sheet · Formation/Casing Pressure Integrity (FIT/LOT) |
| high | tubular | Drillstring Overpull Capacity |
| medium | directional | Average-Angle Survey · Azimuthal Turn Rate · Pipe Tally · Whipstock DLS Expectancy · Time-Depth Drill Schedule (ROP pacing) |
| medium | well control | Stuck-Pipe Free Point (stretch) · BOP Stack / MASICP · Accumulator / Cement / Mud Weight-Up |
| low | directional | Motor Job Material Transfer & Cost Summary |

## C. Enterprise / API-layer architecture (for external AI tooling)

Key points (full list in JSON) — all behind the **repository seam** (mock now, Supabase later):

- **Hierarchical REST tree** mirroring the model (`/assets/{}/structures/{}/slots/{}/wells/{}/
  boreholes/{}/…`), CRUD at every level.
- **Stateless compute endpoints** so external AI never re-implements formulas
  (`POST /calculations/{kill-sheet|ecd|build-to-target|projection|…}`), **idempotent**.
- **Async compute + immutable artifacts** for heavy jobs (anti-collision, reports) via `job_id` poll.
- **Unit-system negotiation** (`?units=field|metric|hybrid`), canonical SI stored, conversion on output.
- **Schema-version negotiation** (`X-Schema-Version`) + migration warnings.
- **Auth/scoping seam** (OAuth2/API-key, least-privilege scopes, per-project membership, audit log).
- **Webhooks** (report-submitted, severity-high, tool-failure) instead of polling.
- **Bulk/chunked export** for data-lake / model-training pipelines.
- Plus the audit's hardening list for AI consumers: **rate-limiting (429/Retry-After), cursor
  pagination, Idempotency-Key, ETag/If-Match optimistic concurrency, a published OpenAPI + AI
  function-calling manifest, and field-level redaction** for PII-scoped fields.

## D. Persistence model — save / load / push / recall

- **Typed-EAV core:** `template_field_defs` (group, key, label, data_type, unit_quantity, validation,
  enum source, **customizable flag**, default) + `field_values` (value, version, actor, timestamp).
- **Templates = the customization unit:** named, versioned bundles of field-defs, scoped per
  client/region/well-type.
- **Save/Load:** upsert values vs the active template version (stamped); load rehydrates by joining
  defs↔values + unit conversion.
- **Push/Recall:** *push* = immutable point-in-time snapshot sent downstream (one-way publish,
  rollback-able); *recall* = open a prior entity/template and **copy-forward** (declarative
  `recall_policy` per field: carry-forward | zero | reset-draft — a recommended addition).
- **Lifecycle write-policies:** immutable (set-once) / mutable (daily) / rolling (inventory);
  submitted reports & definitive surveys freeze with an **amendment log** (field-level deltas).
- **Computed vs stored:** derived fields are formula-locked and recomputed, never persisted as truth.

## E. Roadmap — completeness gaps the audit surfaced (the build backlog)

The critic flagged real gaps to satisfy "**all** non-drilling elements" — captured as future field-def
groups: **Completion/Production string** (perfs, packers, SSSV, artificial lift), **Wellhead/Tree &
surface facilities**, **Plug & Abandonment barriers**, **Formation Tops table + Offset-Well registry**,
generic **Regulatory-Identifier** field (jurisdiction-agnostic), fluids beyond mud, **HSE/QHSE**, and
**AFE/Cost** (already P2). Plus the API-hardening + declarative `recall_policy`/cross-field validation
items above. Full list in the JSON `completeness_gaps` / `recommended_next`.

## F. How this feeds the build

1. **The Bank** (for the Rig Day console) = the activity catalog **+** this field catalog: object
   *types* and their *customizable attributes* come straight from §A.
2. **Calc panels** = §B backlog, each a registry-driven panel on the proven hydraulics shape.
3. **Customizable well-setup + persistence + API** = §A/§C/§D — the spec seed for that subsystem.
4. The world-class software patterns independently surfaced a **Gantt/timeline of runs** and a
   **regional roll-up**, corroborating the Rig Day timeline + fleet-view direction.
