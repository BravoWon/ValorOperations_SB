# Notifications / Exception Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `deriveNotifications(rigDay)` → exceptions (NPT/gap/QC), surfaced as a Notifications panel on the Rig Day console.

**Architecture:** Pure `@valor/core` `notifications` module (derives from `deriveTimeAccounting` + blocks' QC) + a web panel wired into `/rig-day`. No repo seam (derived live). Mirrors shipped patterns.

**Spec:** `docs/superpowers/specs/2026-06-08-notifications-design.md`

**Conventions:** extensionless imports; pure fns never throw; no `Date.now()`/`Math.random()`; reuse `deriveTimeAccounting` + `findBankCode`; export via `index.ts`.

---

## Task 1: `deriveNotifications` (core)

**Files:** Create `packages/core/src/notifications/notifications.ts`, `packages/core/test/notifications.test.ts`; modify `packages/core/src/index.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { deriveNotifications, DEFAULT_NOTIFICATION_RULES } from '../src/notifications/notifications';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';
import type { RigDay } from '../src/rig-day/types';

describe('deriveNotifications', () => {
  it('flags NPT over threshold as critical', () => {
    // DEFAULT_RIG_DAY has a 90-min RIGREP block (> 60 default).
    const n = deriveNotifications(DEFAULT_RIG_DAY);
    expect(n.some((x) => x.category === 'NPT' && x.severity === 'critical')).toBe(true);
  });
  it('no NPT notification under threshold', () => {
    const calm: RigDay = { id: 'd', label: 'D', blocks: [{ id: 'b', code: 'DRL', startMin: 0, endMin: 120 }] };
    expect(deriveNotifications(calm).some((x) => x.category === 'NPT')).toBe(false);
  });
  it('flags a long unaccounted gap as warn', () => {
    const gappy: RigDay = { id: 'd', label: 'D', blocks: [
      { id: 'a', code: 'DRL', startMin: 0, endMin: 60 },
      { id: 'b', code: 'TIH', startMin: 240, endMin: 300 },
    ] };
    expect(deriveNotifications(gappy).some((x) => x.category === 'gap' && x.severity === 'warn')).toBe(true);
  });
  it('flags a QC-flagged block', () => {
    const flagged: RigDay = { id: 'd', label: 'D', blocks: [
      { id: 'a', code: 'DRL', startMin: 0, endMin: 60, qc: { status: 'flagged', note: 'washout' } },
    ] };
    const qc = deriveNotifications(flagged).find((x) => x.category === 'qc');
    expect(qc?.detail).toContain('washout');
  });
  it('empty day → []', () => {
    expect(deriveNotifications({ id: 'd', label: 'D', blocks: [] })).toEqual([]);
  });
  it('sorts critical before warn', () => {
    const n = deriveNotifications(DEFAULT_RIG_DAY);
    const sev = n.map((x) => x.severity);
    const order = { critical: 0, warn: 1, info: 2 } as const;
    expect(sev).toEqual([...sev].sort((a, b) => order[a] - order[b]));
  });
  it('exposes default rules', () => { expect(DEFAULT_NOTIFICATION_RULES.nptThresholdMin).toBeGreaterThan(0); });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test notifications` → FAIL.
- [ ] **Step 3: Implement** `notifications.ts`:

```ts
import type { RigDay } from '../rig-day/types';
import { deriveTimeAccounting } from '../rig-day/time-accounting';
import { findBankCode } from '../well-setup/bank';

export type NotificationSeverity = 'info' | 'warn' | 'critical';
export type NotificationCategory = 'NPT' | 'gap' | 'qc';
export interface Notification { id: string; severity: NotificationSeverity; category: NotificationCategory; title: string; detail: string; }
export interface NotificationRules { nptThresholdMin: number; gapThresholdMin: number; }
export const DEFAULT_NOTIFICATION_RULES: NotificationRules = { nptThresholdMin: 60, gapThresholdMin: 30 };

const SEV_ORDER: Record<NotificationSeverity, number> = { critical: 0, warn: 1, info: 2 };
function hMM(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

export function deriveNotifications(rigDay: RigDay, rules: NotificationRules = DEFAULT_NOTIFICATION_RULES): Notification[] {
  const out: Notification[] = [];
  const blocks = rigDay?.blocks ?? [];
  const acc = deriveTimeAccounting(blocks);

  if (acc.nptMin > rules.nptThresholdMin) {
    out.push({
      id: 'ntf-NPT-1', severity: 'critical', category: 'NPT',
      title: `NPT ${hMM(acc.nptMin)} exceeds ${hMM(rules.nptThresholdMin)} limit`,
      detail: `Non-productive time is ${hMM(acc.nptMin)} of ${hMM(acc.totalLoggedMin)} logged.`,
    });
  }

  let g = 0;
  for (const gap of acc.unaccountedGaps) {
    const dur = gap.endMin - gap.startMin;
    if (dur > rules.gapThresholdMin) {
      g += 1;
      out.push({
        id: `ntf-gap-${g}`, severity: 'warn', category: 'gap',
        title: `Unaccounted ${hMM(dur)} gap`,
        detail: `No activity logged ${hMM(gap.startMin)}–${hMM(gap.endMin)}.`,
      });
    }
  }

  let q = 0;
  for (const b of blocks) {
    if (b.qc?.status === 'flagged') {
      q += 1;
      const label = findBankCode(b.code)?.label ?? b.code;
      out.push({
        id: `ntf-qc-${q}`, severity: 'warn', category: 'qc',
        title: `QC flag on ${label}`,
        detail: b.qc.note ? b.qc.note : `Block ${b.code} flagged for review.`,
      });
    }
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}
```

Add to `index.ts`: `export * from './notifications/notifications';`

- [ ] **Step 4:** test → PASS; full `corepack pnpm --filter @valor/core test` + `typecheck` green. **Step 5:** Commit `feat(core): notifications exception engine (deriveNotifications)`.

## Task 2: `<NotificationsPanel>` + wire into Rig Day

**Files:** Create `apps/web/components/notifications-panel.tsx`, `apps/web/__tests__/notifications-panel.test.tsx`; modify `apps/web/app/(hub)/rig-day/page.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { deriveNotifications, DEFAULT_RIG_DAY } from '@valor/core';
import { NotificationsPanel } from '@/components/notifications-panel';

it('renders a row per notification', () => {
  const ns = deriveNotifications(DEFAULT_RIG_DAY);
  const { getAllByTestId } = render(<NotificationsPanel notifications={ns} />);
  expect(getAllByTestId('notification').length).toBe(ns.length);
});
it('shows an all-clear empty state', () => {
  const { getByText } = render(<NotificationsPanel notifications={[]} />);
  expect(getByText(/all clear/i)).toBeTruthy();
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/web test notifications-panel` → FAIL.
- [ ] **Step 3: Implement** — `NotificationsPanel({ notifications }: { notifications: Notification[] })`: a severity count header; a list where each row is `data-testid="notification"` with a severity dot/chip (critical→`--red`, warn→gold/amber, info→muted), a category chip, title, and detail; empty state "All clear — no exceptions." Reuse the warnings-strip styling. Then in `app/(hub)/rig-day/page.tsx`: `const notifications = useMemo(() => deriveNotifications(day), [day]);` render `<NotificationsPanel notifications={notifications} />` in a card next to the Time Accounting rail, with a count badge on the card title.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): notifications panel on the rig-day console`.

## Task 3: Integrate, verify, ship

- [ ] core `test`+`typecheck`, web `test`+`typecheck`+`build` all green.
- [ ] Restart server; capture `/rig-day` (notifications card visible); send for punchlist.
- [ ] Push `feat/notifications`; open PR (base `master`); action bots per max-adherence; merge on clean review.

## Self-Review
- **Spec coverage:** deriveNotifications (§1 ✓ T1), panel + wiring (§2 ✓ T2), DoD (§4 ✓ T3).
- **Type consistency:** `Notification`/`NotificationSeverity`/`NotificationCategory`/`NotificationRules`/`deriveNotifications`/`DEFAULT_NOTIFICATION_RULES` consistent.
- **No placeholders:** core step carries full code; web step carries signatures, `data-testid` contracts, and tests.
