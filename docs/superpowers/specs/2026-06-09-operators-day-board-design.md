# Slice F — Live "Operator's Day" board (design)

**Parent architecture:** `docs/superpowers/specs/2026-06-08-operations-architecture-design.md` — the Visualization plane ("roll it up"), ⭐ keystone "live Operator's-Day board (the surface)": *"time-aligned day across active sections; the spine made visible."* With Slices B–E merged, every section's day exists as an append-only timeline behind the Repository seam; Slice F renders **all of them on one shared 24-hour axis**.

**Goal:** A read-only Visualization-plane board (`/day`) showing every active section's coded day as a compact row on a shared 24-hour axis — the operator's whole-day spine at a glance — with aggregate KPIs (productive / NPT / active sections) and section-tagged notifications. Rows drill down to the Slice-E2 ticket time-view. **Additive**: reuses the core projections (`timelineToRigDay`, `deriveTimeAccounting`, `deriveNotifications`) unchanged; one new compact row component; no graph writes.

## Key design decisions

1. **New `/day` route under the Visualize plane, `minRole: 'viewer'`.** Visualization is "read-only projections over the graph + event log"; Data Studio (viewer) is the precedent. Registered in `apps/web/lib/planes.ts` (label "Operator's Day").
2. **Per-section projection, reusing the E2 pipeline.** The page loads the coded graph (seed-fallback to `DEFAULT_CODED_GRAPH`/`DEFAULT_TIMELINE` when the repo graph has no sections — the established pattern), then per section: `loadTimeline` (parallel) → `assembleTicket` → `timelineToRigDay` → a `RigDay` per section. Nothing in core changes.
3. **A new compact `DayBoardRow` — NOT a reuse of `RigDayTimeline`.** The detail timeline is built for one section (fixed `h-16`, per-instance hour labels, interactive block `onSelect`, QC overlays). The board needs thin stacked rows (`h-8`), ONE shared hour axis rendered by the board (not per row), and read-only blocks. `DayBoardRow` keeps the same minute→percent math (`left/width = (min / DAY_MINUTES) * 100%`) and the same category→color tinting; the whole row links to `/tickets/[sectionId]` (drill-down to the E2 time-view). `RigDayTimeline` stays untouched.
4. **Aggregate KPIs are computed per-section then summed — never by concatenating blocks.** `deriveTimeAccounting` warns on overlapping blocks; different sections legitimately run in parallel, so concatenation would manufacture false overlap warnings. The board derives a `TimeAccounting` per section and sums `productiveMin`/`nptMin`/`totalLoggedMin`; KPI cards show total productive, total NPT, and the active-section count (visual style mirroring the existing `KpiStrip`).
5. **Notifications are derived per section and tagged at the app layer.** `deriveNotifications(day)` runs per section; the board wraps each result with the section's id/label (an app-layer wrapper type — the core `Notification` shape is NOT changed) and renders them grouped by severity with a section chip, reusing the `NotificationsPanel` styling conventions (or the panel itself if its props fit a pre-labelled list — decided in the plan against the real component).
6. **Client page, statically exportable.** Like the board/time-view, the page is a client component (load-on-mount + seed-fallback works on the GitHub Pages build); the route is static (no dynamic params), so the export grows by exactly one page.
7. **Read-only.** No appends, no QC, no block interaction from the board — detail work stays in the Operate plane (the ticket time-view). The only interaction is row drill-down (and the global Cmd-K palette, which is already shell-wide).

## Web

- **`apps/web/lib/planes.ts`** — add `{ href: '/day', label: "Operator's Day", icon: CalendarClock (or similar unused lucide icon), minRole: 'viewer' }` to the Visualize plane (first item, before Data Studio — it's the keystone surface). Update the planes route-manifest test.
- **`apps/web/components/day-board-row.tsx`** (NEW) — props `{ day: RigDay; href: string }`: a thin row — fixed-width left gutter (section label + code), then the 24h track (hour gridlines, category-tinted blocks via the shared minute→pct math, read-only), wrapped in a `Link` to `href`. `data-testid="day-board-row"`; aria-label naming the section.
- **`apps/web/components/operators-day-board.tsx`** (NEW) — props `{ rows: { day: RigDay; accounting: TimeAccounting; notifications: Notification[] }[] }` (exact shape refined in the plan): renders the shared hour axis once (labels every 3h, aligned to the row gutter), the stacked `DayBoardRow`s, the aggregate KPI cards (summed per-section accounting), and the section-tagged notifications list (severity-ordered).
- **`apps/web/app/(hub)/day/page.tsx`** (NEW, client) — the established load-on-mount flow: graph seed-fallback → per-section timelines (`Promise.all`) → assemble/project/derive per section → render `PageHeader` ("Visualize · Operator's Day") + `OperatorsDayBoard`. `LoadingState` / load-error state / `EmptyState` (no sections) per the tickets-board pattern.

## Testing

- **Web (jsdom):** `day-board-row.test.tsx` — renders blocks positioned from a `RigDay`, links to the ticket href, aria/testid present. `operators-day-board.test.tsx` — renders one row per section, the shared axis once, aggregate KPI numbers equal the per-section sums, notifications carry section labels. A page smoke test if cheap (seed renders one row for `sec-int-1`).
- **Core:** no core changes expected; if the plan surfaces a pure aggregation helper worth extracting (e.g. `sumAccountings`), it gets a unit test — otherwise aggregation stays a trivial page-level reduce.

## Out of scope (deferred)

- Live/auto-refresh (websocket/poll) — the "live" board refreshes on load; real-time push is a later concern.
- Cross-asset roll-ups, NPT Pareto, morning report (Slice G / later Visualization components).
- Any write path from the board; per-row lanes/depth (the detail view has them).

## Success criteria

Both typechecks 0; new tests green; existing suites green; both builds pass (static export +1 page, `/day`). The Visualize plane shows **Operator's Day** for viewer+; the board renders the seed section as a compact row on the shared axis with correct aggregate KPIs; clicking the row opens `/tickets/sec-int-1`; notifications (if any) are section-tagged — demonstrable on the live/static site.
