# Vision & Module Roadmap — Superintendent's Operations Hub

**Date:** 2026-06-07
**Status:** Canonical vision/roadmap (sits above the Phase-1 design spec)
**Companion spec:** `docs/superpowers/specs/2026-06-07-valor-operations-hub-design.md`

## North star

The hub is **a team of executive assistants for the superintendent.** On a VEP site the
superintendent is essentially the *only* operator-company person on-site — everyone else is a
vendor — so the product's whole job is **coordination**: who's on site, what's happening, the
logistics, the messaging, the email, the relationships. The app projects, out from that one
person, everything they'd otherwise carry in their head and on their phone.

## Engineering ethos (guardrails)

- **Simple on purpose.** This is *mostly a database operation + helper*. **No advanced
  mathematics.** (The topological/AI research track stays out of this product.)
- **One mechanism everywhere:** **panels → route input fields → a compute method → the database,
  and back.** Concretely this is the existing `template → field_defs → field_values → Repository`
  engine. Every future module is *more panels on the same substrate* — that's what keeps it simple.
- **Small modules over time.** Each module overlays the one below; no rewrites.

## Meta-layer: condition-state vs activity-state

A lightweight organizing duality (from the user's repos — concept only, no math), applied across
every entity and panel:

- **Condition-state** — the static truth: `assets → pads → wells → wellbores → formations →
  casing`. *(Built: Plan 1–2.)*
- **Activity-state** — the dynamic work: `jobs → stages → events / NPT`. *(Built: Plan 1.)*

Tagging panels/entities as condition vs activity yields "what is" vs "what's happening" views and
is the lens for operational alignment and roll-ups.

## The module stack (the "illuminated scope")

Each band is a small, shippable module overlaying the one below — same DB-centric substrate.

| Band | Module | Status |
|---|---|---|
| **Substrate** | Panel/field-registry engine · condition model · activity model · repository seam | ✅ Built (Plan 1–2) |
| **People & Vendors** | Vendors + contacts + crews; the superintendent as the hub (extends `service_companies`/`rigs`) | Planned |
| **Superintendent Desk** | "My day" — who's on site, today's jobs/stages, open items, daily report | Planned |
| **Coordination** | Logistics/scheduling · notes/messaging/handoffs threaded to jobs·vendors·stages | Planned |
| **Integrations (O365)** | Supabase Azure OAuth → Microsoft Graph (email, calendar, files) · Teams · Power BI | Long-term |
| **Meta overlay** | condition⇄activity tagging across everything → alignment & roll-up views | Cross-cutting |

## The O365 unlock

Once identity is Microsoft (Supabase supports the Azure/Entra OAuth provider), email, calendar,
files (Microsoft Graph), Teams notifications, and Power BI embedding stop being "integrations" and
become native surfaces of the superintendent's desk. This is the long-term force multiplier and
ties back to the existing "O365/Power BI EDR" vision in the training repo.

## Relationship to the existing plans

This roadmap does **not** change the foundation work — it *extends* it. The Phase-1 design spec and
Plans 1–2 remain valid. New modules each get their own spec addendum → plan → implementation cycle,
built on the substrate, following `docs/superpowers/process/review-pipeline.md`.

Current build order: **Plan 1 (foundation) ✅ merged → Plan 2 (asset hierarchy) in progress →**
then the next module is chosen from the stack above (likely People & Vendors → Superintendent Desk),
with Templates/Jobs UI (original Plan 3) folded in where it serves the desk.
