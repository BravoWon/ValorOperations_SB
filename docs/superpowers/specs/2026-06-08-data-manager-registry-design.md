# Data Manager — Editable Channel Registry — Design Spec

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/data-manager-registry`

**Goal:** Activate the **Data Manager** workspace with its core surface — the **editable channel/mnemonic
registry**: a CRUD table where the **mnemonic AND the channel assignment** (which incoming wire/source
channel feeds a field) are user-editable, alongside units, precision, source, range, and alarms.
Directly fulfils b.jones's first directive ("mnemonic and channel assignment should be editable") and
the EDR `idtable` pattern from the mining.

**Non-goals (later):** EDR/WITS/LAS file ingestion, document management, data-quality dashboards. The
registry is the editable backing for `template_field_defs`; persistence is the mock adapter for now.

---

## 1. Core (`packages/core/src/data-manager/`)

```ts
export type ChannelSource = 'WITS' | 'LAS' | 'Manual' | 'Calc';
export type ChannelDataType = 'number' | 'text';

export interface ChannelDef {
  id: string;            // stable internal id
  channelId: string;     // EDITABLE assignment — the incoming wire/source channel (witsid)
  mnemonic: string;      // EDITABLE short code
  label: string;         // human description
  unit: string;          // engineering unit
  dataType: ChannelDataType;
  dp: number;            // decimal places (display precision)
  source: ChannelSource;
  min: number; max: number;
  alarmLo?: number; alarmHi?: number;
  enabled: boolean;
}

export const CHANNEL_SOURCES: ChannelSource[];   // for the source picker
export const DEFAULT_CHANNELS: ChannelDef[];     // ~16 generic drilling channels (abstracted from idtable)
export function validateChannels(channels: ChannelDef[]): string[]; // dup mnemonic / dup channelId / min>=max / bad dp
export function blankChannel(seq: number): ChannelDef;              // for "Add row" (deterministic id by seq)
```

`DEFAULT_CHANNELS` is generic/brand-free (WOB, ROP, RPM, Standpipe Pressure, Flow In/Out, MW In/Out,
Hookload, Bit Depth, Hole Depth, Torque, Pump SPM, Block Height, Gas, ECD, Bit RPM) with realistic
units/ranges. `validateChannels` returns human warnings (never throws). Repo seam:
`saveChannels(channels)` / `loadChannels()` (localStorage `valor:channels` + in-memory `Map` fallback,
mirroring `saveWellSetup`).

## 2. Web

- **Activate Data Manager:** in `lib/areas.ts`, set `data-manager` `status: 'active'`, `href: '/data-manager'`.
  Replace the coming-soon `app/(areas)/data-manager/page.tsx` with the real screen (move it under the hub
  shell so it gets the sidebar — `app/(hub)/data-manager/page.tsx`; the `(areas)` coming-soon stays for
  the still-soon workspaces).
- **`<ChannelRegistry>`** — a registry table over `ChannelDef[]`: each row edits mnemonic, **channel
  assignment** (channelId), label, unit, dataType (select), dp, source (select over `CHANNEL_SOURCES`),
  min, max, alarmLo, alarmHi, and an enabled toggle. Add row / remove row. A **search** box filters by
  mnemonic/label/channelId. A **validation** strip shows `validateChannels` warnings (dup mnemonic in
  red). Controlled (`channels`, `onChange`).
- **`/data-manager` page** (`'use client'`): `getRepo().loadChannels()` (fallback `DEFAULT_CHANNELS`),
  state, `<ChannelRegistry>`, a **Save** button → `saveChannels`, the validation strip, and a
  `PageHeader` ("Data Manager / Channel Registry"). Add a "Data Manager" nav item to `app-shell.tsx`.

## 3. Files

- Core: `data-manager/types.ts` (`ChannelDef`, sources), `data-manager/channels.ts` (`DEFAULT_CHANNELS`,
  `validateChannels`, `blankChannel`); repo seam edits; `index.ts` export; tests (validate dup mnemonic/
  channelId/min>=max; seed integrity; blankChannel deterministic).
- Web: `components/channel-registry.tsx`; `app/(hub)/data-manager/page.tsx`; `lib/areas.ts` (+ remove the
  `(areas)/data-manager` coming-soon route); `components/app-shell.tsx` nav; RTL tests (edit mnemonic
  fires onChange; source select; add/remove; search filters; dup-mnemonic warning shows).

## 4. Definition of done

Launcher shows **Data Manager** as live; open it → an **editable channel registry**: rename a mnemonic,
reassign a channel, change units/precision/source/alarms, add/remove rows, search, and **Save** — with
dup-mnemonic validation — all on the mock adapter, in the Valor brand, on the live link.

## 5. Review

Standard pipeline (gates 1–8) + dual-bot PR review with **max adherence**. PR base = `master`.
