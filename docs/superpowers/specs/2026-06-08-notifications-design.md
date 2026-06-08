# Notifications / Exception Engine — Design Spec

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/notifications`

**Goal:** Turn the data the console already holds into **actionable exceptions** — a pure
`deriveNotifications(rigDay)` that flags NPT over threshold, unaccounted gaps beyond a configurable threshold (default 30 min), and QC-flagged
blocks, surfaced as a **Notifications panel** on the Rig Day console with a severity-coded list + count
badge. Derived, not hand-built — the calculation made first-class.

**Non-goals (later):** time-based reminders (BOP test due, vendor ETA — needs a scheduling layer),
push/email delivery (O365/Graph), channel-alarm breaches (need live data), persisted dismissals.

---

## 1. Core (`packages/core/src/notifications/`)

```ts
import type { RigDay } from '../rig-day/types';

export type NotificationSeverity = 'info' | 'warn' | 'critical';
export type NotificationCategory = 'NPT' | 'gap' | 'qc';
export interface Notification {
  id: string; severity: NotificationSeverity; category: NotificationCategory;
  title: string; detail: string;
}
export interface NotificationRules { nptThresholdMin: number; gapThresholdMin: number; }
export const DEFAULT_NOTIFICATION_RULES: NotificationRules = { nptThresholdMin: 60, gapThresholdMin: 30 };

export function deriveNotifications(rigDay: RigDay, rules?: NotificationRules): Notification[];
```

`deriveNotifications` (pure, never throws): runs `deriveTimeAccounting(rigDay.blocks)`, then:
- `nptMin > rules.nptThresholdMin` → **critical** NPT notification (e.g. "NPT 1:30 exceeds 1:00 limit").
- each `unaccountedGaps[]` longer than `gapThresholdMin` → **warn** gap notification (with the time span).
- each block with `qc?.status === 'flagged'` → **warn** qc notification (block code + note).
Returns sorted by severity (critical → warn → info), deterministic ids (`ntf-<category>-<n>`).

No repo seam (notifications are derived live). Exported via `index.ts`.

## 2. Web

- **`<NotificationsPanel>`** — `{ notifications }`: a list, each row `data-testid="notification"` severity-
  coded (critical = red, warn = gold/amber, info = muted) with category chip + title + detail; an empty
  state ("All clear — no exceptions."). A header count by severity.
- **Rig Day console** (`/rig-day`): compute `notifications = deriveNotifications(day)` (memoized);
  render `<NotificationsPanel>` in a card (near the accounting rail) + a small **count badge** on the
  card title. (A global header bell is a later refinement — the data lives on this page for now.)

## 3. Files

- Core: `notifications/notifications.ts` (types + rules + `deriveNotifications`); `index.ts` export;
  tests (NPT over/under threshold; gap threshold; flagged-qc; severity sort; empty → []).
- Web: `components/notifications-panel.tsx`; extend `app/(hub)/rig-day/page.tsx`; RTL tests (renders a
  notification per item; empty state).

## 4. Definition of done

On `/rig-day`, a **Notifications** card lists the day's exceptions (NPT critical, long unaccounted gaps,
QC-flagged blocks) severity-coded with a count — recomputing live as the day is edited/QC'd — on the
mock adapter, in the Valor brand, on the live link.

## 5. Review

Standard pipeline (gates 1–8) + dual-bot PR review with **max adherence**. PR base = `master`.
