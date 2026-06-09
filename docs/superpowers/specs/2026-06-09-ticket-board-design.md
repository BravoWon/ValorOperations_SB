# Slice E — Section/Ticket board + "search the Bank" palette + Rig-Day time-view (design)

**Parent architecture:** `docs/superpowers/specs/2026-06-08-operations-architecture-design.md` — the Operation plane ("work the ticket"), ⭐ keystones "Section/Ticket board", "search the Bank command palette", and "Rig-Day = the Ticket's time view". Slice E is the integration keystone: it turns the coded-object substrate (B), the Bank (C), and templates (D) into the **operator-facing surface**.

**Goal:** Surface the coded-object graph as the operator's work queue. A **Ticket board** (`/tickets`) lists each section (a `CodedObject` of `type:'section'`) as a card assembled via `assembleTicket`; a **"search the Bank" command palette** (Cmd/Ctrl-K) makes the code catalog instantly reachable; and the **Rig-Day visuals become a Ticket's time-view** — rendering a ticket's append-only `timeline` through the existing rig-day timeline/lanes, with new activities appended via the palette. This is the **first slice that consumes the substrate** (reads `loadCodedGraph`/`loadTimeline`).

**Sequenced as two PRs (full keystone):**
- **E1 — Ticket board + Bank command palette** (read surface + global palette).
- **E2 — Rig-Day as the Ticket's time-view** (the ticket time-view reusing the rig-day visuals; appends via the palette).

## Key design decisions

1. **New `/tickets` route in the Operate plane** (not an augmentation of `/jobs`). Tickets (sections) are the unit of work in the coded-object model; Jobs are the administrative roll-up. `minRole: 'field'` (operator-facing, consistent with `/jobs` "Active Jobs"). Registered in `apps/web/lib/planes.ts`.
2. **Board reads the graph; assembly is pure.** The board loads `loadCodedGraph(orgId)` + each section's `loadTimeline(orgId, sectionId)`, then renders one `TicketCard` per section via `assembleTicket`. A new pure `@valor/core` helper `summarizeTicket(view): TicketSummary` (label, code, bankLabel, status, party/equipment/bha counts, timelineCount, latestActivity, warningCount) keeps card logic testable and deterministic. **E1 is read-only** over the seed graph (no graph writes yet).
   - **Seed fallback (important):** unlike `/jobs` (which reads the in-memory `this.data` seed), `loadCodedGraph` returns an **empty** graph on a fresh Mock (the Slice-B `DEFAULT_CODED_GRAPH`/`DEFAULT_TIMELINE` are constants, never auto-persisted). So the board falls back to `DEFAULT_CODED_GRAPH` + `DEFAULT_TIMELINE` when the loaded graph has no `section` objects — the same seed-fallback pattern as bank-editor (`BANK_SEED`) and template-builder (`DEFAULT_TEMPLATE_BUNDLES`). The E2 time-view likewise falls back to the seed timeline for the seed ticket.
3. **The "search the Bank" palette is a global Cmd/Ctrl-K dialog.** A new `BankSearchPalette` (modal overlay, since no dialog primitive exists yet) searches the *persisted* Bank (`loadBankCodes()` ?? `BANK_SEED`) by code/label/category, grouped by category (NPT in red), keyboard-navigable (↑/↓/Enter/Esc). A small global key handler (in the app shell) opens it anywhere; the board also has a "Search the Bank" button. **In E1 the palette is a reference picker** — selecting a code surfaces its detail (code · label · category · NPT/billable); an optional `onSelect` lets a host (E2's time-view) receive the pick to append an activity. No mutation in E1.
4. **E2 wires Rig-Day as the Ticket's time-view via a BRIDGE, not a migration.** The existing `/rig-day` console (rich `RigDay`/`TimeBlock` model) stays intact. E2 adds a **ticket time-view** (`/tickets/[ticketId]`) that renders the ticket's `timeline` (`TimelineEvent[]`) through the *existing* rig-day visual components, via a pure adapter `timelineToBlocks(events): TimeBlock[]` (activity events → blocks spanning to the next event/`atMin`; `qc` events → a `QcMark` on the covering block) and the ticket's related parties/equipment → lanes. Time-accounting (`deriveTimeAccounting`) and notifications (`deriveNotifications`) are reused over the projected blocks. **Appends are append-only**: selecting a code in the palette calls `appendTimelineEvent` for that ticket; QC marks append a `qc` event. No rewrite of the `RigDay` storage model; depth detail and full block-editing stay with the standalone `/rig-day` console (the ticket time-view focuses on the coded activity timeline). This makes "Rig-Day = the Ticket's time view" real with minimal risk.
5. **Static-export safe.** The board may render server-side (like `/jobs`) but the graph read is client-friendly; the palette + time-view are client components (like `/rig-day`/`/bank-editor`). All work on the GitHub Pages static build via the Mock/localStorage path. `generateStaticParams` for `/tickets/[ticketId]` is gated on `STATIC_EXPORT` (pre-render the seed section ids), mirroring the wells route.
6. **Additive.** New route(s) + components + pure helpers. Existing `/rig-day`, `/jobs`, the coded-object repo methods, and all prior slices are untouched. The board consumes the seed graph (the first real consumption); deeper write flows (creating tickets from templates) remain a later step.

## E1 — Ticket board + Bank palette

**Core (`@valor/core`):**
- `summarizeTicket(view: TicketView): TicketSummary` (new, in `coded-object/`): pure, deterministic; `{ id, label, code, bankLabel, category, status, parties, equipment, bha, timelineCount, latestActivity?: { code; atMin; bankLabel }, warningCount }`. Uses `findBankCode` for `bankLabel`/`category` (tolerates unknown codes → undefined). Test: over `assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)`.

**Web:**
- `apps/web/lib/planes.ts` — add `{ href: '/tickets', label: 'Tickets', icon: <lucide e.g. Ticket or ClipboardList>, minRole: 'field' }` to the Operate plane (after `/jobs`).
- `apps/web/app/(hub)/tickets/page.tsx` — load `loadCodedGraph(DEMO_ORG_ID)` + each section's timeline; assemble + `summarizeTicket`; render `PageHeader` + a responsive `TicketCard` grid + a "Search the Bank" button that opens the palette. `EmptyState` when no sections. Mirror the established page conventions; client-side load (works on static export).
- `apps/web/components/ticket-card.tsx` — a card from a `TicketSummary`: label, code chip (Bank category color), status badge, parties/equipment counts, timeline count + latest activity, a warning indicator when `warningCount>0`, and a "View timeline" link to `/tickets/[id]` (the E2 detail; in E1 the link target may be a stub/board-detail).
- `apps/web/components/bank-search-palette.tsx` — the Cmd/Ctrl-K modal overlay: search input, category filter, grouped results (reuse the look of the existing `bank-palette.tsx`), keyboard nav, `aria` dialog semantics; props `{ open, onClose, onSelect?, codes }`. A small open/close handler wired in `app-shell.tsx` (Cmd/Ctrl-K, Esc) — guarded so it doesn't interfere with inputs.
- Tests (jsdom): `ticket-card.test.tsx` (renders summary fields, warning indicator, link href); `bank-search-palette.test.tsx` (filters by code/label/category, groups, calls `onSelect`, Esc closes); a board smoke test if the page is testable.

## E2 — Rig-Day as the Ticket's time-view

**Core:**
- `timelineToBlocks(events: TimelineEvent[]): TimeBlock[]` (pure, in `coded-object/` or `rig-day/`): projects `activity` events into `TimeBlock`s (`code`, `startMin = atMin`, `endMin = next event's atMin or 1440`), attaches a `qc` event's mark to the covering block; ignores `note`/`hse`/`milestone` for block rendering (surfaced separately). Deterministic. Tested over `DEFAULT_TIMELINE`.
- Reuse `deriveTimeAccounting` + `deriveNotifications` over the projected blocks (build a transient `RigDay` from `timelineToBlocks` + the ticket's parties/equipment lanes).

**Web:**
- `apps/web/app/(hub)/tickets/[ticketId]/page.tsx` — client time-view: load the graph + `loadTimeline(orgId, ticketId)`, `assembleTicket`, project to blocks, render the **existing** `RigDayTimeline` + `RigDayLanes` (lanes from the ticket's parties/equipment) + `TimeAccountingRail` + `NotificationsPanel` (warnings from `assembleTicket` + derived notifications). A "Search the Bank" / "Log activity" affordance opens the palette; selecting a code calls `appendTimelineEvent({ orgId, ticketId, atMin: <end of day or picked>, kind: 'activity', code })` and reloads the timeline. QC: selecting a block → append a `qc` event. `generateStaticParams` gated on `STATIC_EXPORT` returns the seed section ids.
- Adapt (don't fork) the rig-day visual components to accept the projected blocks/lanes (they already take `TimeBlock[]`/`LaneItem[]`); if a component reads rig-day-specific shapes, pass the adapter output.
- Tests: `timelineToBlocks` core test; a time-view render/append test (jsdom) asserting blocks render from the seed timeline and a palette pick appends an event.

## Reuse vs new

- **Reuse:** `RigDayTimeline`, `RigDayLanes`, `TimeAccountingRail`, `NotificationsPanel`, `deriveTimeAccounting`, `deriveNotifications`, `Card`/`PageHeader`/`LoadingState`/`EmptyState`, `RoleGate`, `getRepo`/`DEMO_ORG_ID`, `bank-palette` look.
- **New:** `summarizeTicket`, `timelineToBlocks` (core); `/tickets` + `/tickets/[ticketId]` pages; `TicketCard`, `BankSearchPalette` (+ app-shell Cmd-K handler); their tests.

## Out of scope (deferred)

- **Creating tickets from templates** (instantiate a section CodedObject + seed `fields`/`code` from a `TemplateBundle`) — a later "instantiation" step; E1/E2 consume the existing seed graph.
- **Full mutable block editing in the ticket time-view** (depth ranges, drag-resize, recall "reuse") — stays with the standalone `/rig-day` console; the ticket time-view focuses on the coded activity timeline (render + append + QC).
- **Migrating the `RigDay` storage model onto `TimelineEvent`** — explicitly NOT done; the bridge/adapter keeps both intact.
- **Cloud (Supabase) consumption / RLS** — the board reads the Mock graph; cloud is the parallel track.

## Testing & success criteria

- `@valor/core`: `summarizeTicket` + `timelineToBlocks` pure tests green; existing core tests unaffected; no `Date.now`/`Math.random`.
- `@valor/web`: typecheck 0; new component/page tests green; existing tests green; planes route-manifest test includes `/tickets`.
- Both builds compile (normal + static export); the static export pre-renders `/tickets` and the seed `/tickets/[ticketId]`.
- **E1:** the Operate plane shows **Tickets**; the board renders the seed section(s) as cards with code/status/relations/timeline summary; the Cmd-K palette searches the Bank and is keyboard-navigable; below-`field` roles are gated.
- **E2:** opening a ticket shows the rig-day timeline rendered from that ticket's append-only events (+ lanes from its parties/equipment, time-accounting, notifications); picking a Bank code appends an activity event; QC marks append a qc event — all demonstrable on the live/static site.
