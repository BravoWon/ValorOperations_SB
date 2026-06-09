# Slice G — Shift handoff + Morning report (design)

**Parent architecture:** `docs/superpowers/specs/2026-06-08-operations-architecture-design.md` — the final roadmap slice (▲ High): *"Shift handoff + Morning report — carry-forward + report artifact from the graph."* With A–F merged, every section's day is a derived projection over the append-only timeline; Slice G turns those projections into the two operator artifacts that close the daily loop: the **morning report** (Visualization: "see & decide") and the **shift handoff** (Operation: "work the ticket" → hand it over).

**Goal:** Two thin, faithful artifacts derived from the existing projections — no new storage model:
- **G1 — Morning report** (`/morning-report`, Visualize, `field`+): a **printable** per-day report assembled per section from `assembleTicket` → `timelineToRigDay` → `deriveTimeAccounting`/`deriveNotifications`, plus the timeline's so-far-unrendered `note`/`hse`/`milestone` events and flagged QC. Printed via the existing `window.print()` + print-CSS conventions (no PDF machinery).
- **G2 — Shift handoff** (an action in the ticket time-view, Operate): a pure `deriveHandoff(view, cutoffMin)` summary (completed work, the carry-forward open block, pending QC flags/notifications) that the operator reviews, annotates, and **signs** — recording the handoff as an appended **`milestone` TimelineEvent** (append-only audit; carry-forward stays computed, never hidden state).

**Sequenced as two PRs:** G1 (read-only report) ships first; G2 (the one write — a milestone append) follows.

## Key design decisions

1. **Everything derives from existing projections; one new pure module per PR.** `packages/core/src/report/morning-report.ts` and `packages/core/src/report/shift-handoff.ts`, following the `deriveTimeAccounting`/`deriveNotifications` conventions (pure, deterministic, `warnings: string[]`, never throw; no `Date.now`/`Math.random` — the "as-of" minute is caller-supplied). Surfaced via `index.ts`.
2. **G1 `deriveMorningReport(view: TicketView, rules?: NotificationRules): MorningReportSection`** — per section: `{ ticketId, sectionLabel, code?, bankLabel?, status?, accounting: TimeAccounting, parties: string[], equipment: string[], flaggedQc: { atMin, note? }[], journal: { atMin, kind: 'note'|'hse'|'milestone', note? }[], notifications: Notification[], warnings }`. The page composes one `MorningReportSection` per active section (same load/seed-fallback pipeline as `/day`). This finally **surfaces the `note`/`hse`/`milestone` kinds** (currently unrendered anywhere) in a journal list — read-only; authoring them is out of scope.
3. **G1 rendering = a printable page, not export machinery.** `/morning-report` (Visualize, after Operator's Day; icon e.g. `FileText`; `minRole: 'field'`). Header (org/date placeholder + section count), per-section: KPI line (productive/NPT/gaps from `TimeAccounting`), the code tally table (`CodeTally[]` sorted by minutes), flagged QC, the journal, notifications. A "Print" button calls the existing `printDiagram()`-style `window.print()`; the page uses the established `.no-print` convention + a local `@media print` block (solid backgrounds, page-break-inside avoid per section). Print fidelity follows the rig-day "print-clean" precedent.
4. **G2 `deriveHandoff(view: TicketView, cutoffMin: number, rules?): ShiftHandoff`** — `{ ticketId, sectionLabel, cutoffMin, completedWork: CodeTally[] (blocks truncated at the cutoff), carryForwardBlock: TimeBlock | null (the block spanning the cutoff, truncated note of what continues), pendingQcFlags, pendingNotifications, warnings }`. Cutoff is **operator-chosen at sign time** (a simple minute picker defaulting to the latest block end) — no new shift-configuration model (YAGNI; a fixed per-rig cutoff is a later Admin concern).
5. **G2 signing = one append, no new storage.** "Sign handoff" in the ticket time-view opens a drawer/modal: the derived summary + a free-text narrative; confirming appends `{ kind: 'milestone', atMin: cutoffMin, note: 'Shift handoff @ HH:MM — <narrative>' }` via the existing `appendTimelineEvent` (id via the established client-side id pattern). The milestone then appears in G1's journal — the loop closes. No `RigDay` change, no handoff table, no mutation.
6. **Additive throughout.** No changes to the rig-day components, `/day`, `/tickets`, or any core projection; the only write path is the one milestone append (reusing the time-view's existing guarded append plumbing). Static export +1 page (`/morning-report`).

## Out of scope (deferred)

- Authoring `note`/`hse` events (a timeline-event editor is a future slice; G renders them).
- PDF/email/Power BI delivery of the report (the O365 bridge horizon); fixed per-rig shift schedules (Admin, later); QC state carry-forward beyond re-derivation; multi-day reports.

## Testing & success criteria

- Core: `morning-report.test.ts` + `shift-handoff.test.ts` over the seed ticket (+ synthetic timelines for cutoff-spanning blocks, flagged QC, journal kinds, empty timeline). Deterministic; warnings conventions.
- Web: report page renders per-section content from the seed (jsdom); the handoff drawer derives at a cutoff and the sign action appends a milestone (assert via the mock repo). Planes test gains `/morning-report`.
- Both typechecks 0; both builds pass (static export +1 page); existing suites green; IP guardrail (generic terms only).
- Demonstrable: `/morning-report` prints cleanly; signing a handoff in a ticket adds a milestone visible in the next report's journal.
