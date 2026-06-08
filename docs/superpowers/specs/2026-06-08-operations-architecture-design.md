# Valor Operations Hub — Architecture Re-envision (operator workflow alignment)

**Status:** Approved design (2026-06-08). North-star architecture; decomposed into slices A–G. Each slice gets its own implementation plan via `writing-plans`. This document is the shared reference for all of them.

**Goal:** Re-organize the hub around the operator's actual workflow so every capability hangs off one coherent model — turning the workspace-by-workspace app into a single role-aware surface over a coded-object graph, with the operator's time-aligned day as the felt experience.

## Locked keystone decisions

Established interactively (visual brainstorming, 2026-06-08):

1. **Spine = the Operator's Day rendered from the coded-object substrate (hybrid "D").** The felt workflow is the time-aligned day; the data truth is the coded-object graph; the job lifecycle is the backbone state.
2. **Structure = role-aware single surface ("C").** One cohesive hub that adapts to the signed-in role (`owner · admin · ops · field · vendor · viewer`) — not separate per-role apps. Preserves the one-console feel; maps onto the scaffolded Supabase roles/RLS.
3. **Central object = the coded Section / "Ticket" ("A").** A section of the well is the unit of work (the "ticket" in the Zendesk-ported analogy). The **Rig-Day is its time-axis view**, the **Job is its roll-up parent**, the **Well/Asset is its place**. Everything (parties, equipment, BHA, activities, calcs, cost, QC, attachments) attaches to it and rolls up from it.
4. **Substrate = coded-object graph + timeline/QC event log (hybrid "A+C").** Typed-EAV (`template_field_defs` / `field_values`, extended to every object) + one `relations` edge table, with time as a first-class indexed dimension; tickets are snapshots over the graph. Plus an **append-only event log scoped to the timeline + QC trail** for replay/audit — without full event-sourcing weight.

## The cohesive framework ("one model")

```
ROLE-AWARE SINGLE SURFACE  (one hub; role reveals/prioritizes planes & actions)
                 ┌───────────────────────────────────────────┐
                 │   ◆ THE CODED SECTION / "TICKET"           │
                 │   Rig-Day = time view · Job = roll-up      │
                 │   header·timeline·parties·equipment·BHA·   │
                 │   events/NPT·calcs·cost·QC·attachments      │
                 └───────────────────────────────────────────┘
   OPERATION          VISUALIZATION        ADMINISTRATIVE        DATABASE
   work the ticket    roll it up           govern it             store it
        \                  \                   /                    /
         coded-object graph (typed-EAV + relations) + timeline/QC event log
                       Repository seam (mock → Supabase RLS)
   ↕ CALCULATION ENGINE (@valor/core, pure/deterministic) — calc is first-class
```

**Why it holds together:** one object (the Ticket) makes the Zendesk analogy, the coded-object primitive, and time-alignment the same thing; the four planes become *capabilities over one graph*, not separate apps; "config not code" (new codes/objects/fields via the Bank + field-defs); calc stays orthogonal and reusable.

**What it demands:** a disciplined coded-object / relations convention; the Bank + field-defs become the curated source of truth; the role/permission model is threaded everywhere (Supabase RLS).

## The four planes (dimensionalized)

Each along: **Mandate · What the operator does · How it touches the Ticket/graph · Components** (✓ exists, ◆ new component of merit).

### ① Operation — "work the ticket"
- **Mandate:** execute & log the active section in real time.
- **Does:** open active Ticket → live Rig-Day (24h/5-min) → log activity·people·equipment blocks → flag events/NPT (HSE/env) → recall like-items & QC → clear notifications → shift handoff.
- **Touches:** writes the timeline/QC event log + ticket state; reads the Bank for codes.
- **Components:** ✓ Rig-Day console · ✓ Recall/QC · ✓ Notifications | ◆ Section/Ticket board · ◆ "search the Bank" command palette · ◆ Shift handoff · ◆ HSE/Env capture.

### ② Administrative — "govern it" (config-not-code control plane)
- **Mandate:** curate the source-of-truth every other plane consumes.
- **Does:** edit the Bank (code catalog) · job/section templates · field-defs · channel/mnemonic registry · vendors/parties · AFE setup · roles & permissions.
- **Touches:** writes *definitions*; read-mostly by everyone else.
- **Components:** ✓ Data Manager · ✓ Office Ops | ◆ Bank editor · ◆ Template builder · ◆ Field-def/registry editor · ◆ Roles & permissions · ◆ unit & recall policy.

### ③ Database — "store it" (persistence + lifecycle)
- **Mandate:** durable, portable, governed storage of the coded-object graph.
- **Does:** save/load/recall · snapshots (export/import) · provenance/audit · sync (mock → Supabase) · soft-delete/restore/retention.
- **Touches:** *is* the substrate — every plane reads/writes through the Repository seam.
- **Components:** ✓ Repository seam · ✓ Local DB workbench · ✓ Supabase scaffold | ◆ coded-object graph (EAV+relations) · ◆ timeline/QC event log · ◆ Auth + per-request SSR client · ◆ External API layer · ◆ lifecycle (soft-delete/retention/provenance).

### ④ Visualization — "roll it up" (see & decide)
- **Mandate:** turn coded data into operator decisions & reports.
- **Does:** scan KPIs/trends · NPT Pareto · wellbore schematic · live "Day" board · morning report · cross-asset roll-ups · export/print.
- **Touches:** read-only projections over the graph + event log.
- **Components:** ✓ Data Studio · ✓ Wellbore schematic · ✓ Diagram export | ◆ live Operator's-Day board (the surface) · ◆ Morning report generator · ◆ Section/Job dashboards · ◆ O365/Teams/Power BI bridge (horizon).

**Cross-cut:** the calculation engine (`@valor/core`) feeds Operation decisions and Visualization roll-ups; calc modules attach to tickets. ▲ more calc modules (kill sheet · build-to-target · bottoms-up · pump output …).

## Components of merit — tiers

- **⭐ Keystone (unlocks the model):** coded-object graph store · timeline/QC event log · the Bank editor · Template builder · Field-def editor · Section/Ticket board · "search the Bank" palette · live Operator's-Day board.
- **▲ High:** Shift handoff · Roles & permissions · Auth + SSR · Morning report · Section/Job dashboards · more calc modules.
- **○ Supporting:** HSE/Env capture · unit & recall policy · External API layer · lifecycle · O365/Teams/Power BI bridge.

## Build sequence (evolve in place, additively — each slice ships working software)

Same pipeline: spec → plan → subagent build (TDD) → dual-bot review (CodeRabbit + Copilot, action-or-justify) → merge. The live demo stays green throughout.

- **A · Role-aware 4-plane shell** *(IA reorg, low risk — FIRST)* — regroup nav into Operate · Visualize · Administer · Data + role-aware gating. Ships the re-envisioned surface using existing pieces.
- **B · Coded-object model + Ticket** *(⭐ substrate, core + mock, no creds)* — graph (typed-EAV + relations) + the Section/Ticket coded object + timeline/QC event log + MockRepository graph CRUD/event-append; existing Rig-Day/Well-Setup become Ticket facets.
- **C · Bank editor** *(⭐ Admin)* — editable, persisted code catalog.
- **D · Template + Field-def builder** *(⭐ Admin)* — templates (stages · default codes · field-defs) → instantiate Tickets.
- **E · Section/Ticket board + "search the Bank" palette** *(⭐ Operation)* — the queue home; Rig-Day becomes the Ticket's time-view.
- **F · Live "Operator's Day" board** *(⭐ Visualization)* — time-aligned day across active sections; the spine made visible.
- **G · Shift handoff + Morning report** *(▲)* — carry-forward + report artifact from the graph.

**Parallel track (needs creds):** Supabase Auth + SSR client + API layer + RLS — independent of A–G; slots in when the live project exists. **Ongoing track (independent):** more calc modules.

## Slice A — Role-aware 4-plane shell (this slice's spec)

**Goal:** Reorganize the hub's information architecture into the four planes and make the surface adapt to the signed-in demo role — realizing keystone decision C with the components that already exist, with zero data-model change.

**Scope (in):**
- A **plane registry** (`apps/web/lib/planes.ts`): the four planes (Operate · Visualize · Administer · Data), each with id, label, icon, and the existing routes that belong to it, plus the minimum role that may see each route.
- **Sidebar reorganized by plane** (`app-shell.tsx`): nav grouped under the four plane headings instead of a flat list; the current routes slot in (Operate: dashboard·jobs·rig-day·assets·well; Visualize: data-studio·hydraulics·directional; Administer: data-manager·office-ops; Data: local-db). Active-state + branding unchanged.
- A **role context** (`apps/web/lib/role.ts` + a small client provider): resolves the current demo role from a dedicated `valor_demo_role` cookie (defaulting to `owner`), exposed via a hook. A separate cookie — rather than overloading `valor_demo_auth` — keeps the existing AuthGate untouched. No real auth change — demo-only, mirrors the existing placeholder gate.
- **Role-gating** in the sidebar: routes whose minimum role exceeds the current role are hidden; a route visited directly above the role shows a branded "not available for your role" state (client-side, consistent with the static-export AuthGate pattern).
- A **role switcher** in the shell (demo affordance) so the surface's role-adaptation is demonstrable on the live/static site.

**Scope (out):** the coded-object model (Slice B), any new editor/board, Supabase wiring, real authn/z. Routes themselves are unchanged — only grouped, gated, and surfaced.

**Architecture:** pure presentation/IA layer over existing routes. `planes.ts` is data (a typed array); `role.ts` is a tiny pure resolver + a client context; `app-shell.tsx` consumes both. Everything testable: plane-registry integrity test (every existing hub route appears in exactly one plane; every route has a valid min-role), role-resolver unit tests, and a shell render test (gating hides above-role routes). No `@valor/core` change.

**Success criteria:** sidebar shows the four plane groups; switching role hides/reveals routes correctly; all existing routes still load; `@valor/web` typecheck 0 + tests green; both normal and static-export builds compile; the live demo shows the plane-organized, role-aware shell.

## Notes / constraints carried forward

- **Mock stays the default**; Supabase only when env is set. Slices A–G build on the mock; the cloud track is parallel.
- **IP guardrail (standing):** no brand/product/personnel/client/well/location names; mine abstractly only.
- **Two hosting venues** stay green: loca.lt dev link + GitHub Pages static export. Slice A must pass the static export (client-side role gating, like AuthGate).
- **YAGNI:** Slice A is IA + role-adaptation only; resist pulling Slice B's model forward.
