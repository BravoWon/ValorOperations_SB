# Widget Architecture — Design Spec

**Date:** 2026-06-07
**Status:** Draft for review
**Companion:** `docs/superpowers/specs/2026-06-07-valor-operations-hub-design.md` (foundation),
`docs/superpowers/specs/2026-06-07-vision-superintendent-module-roadmap.md` (vision)

## 1. Summary

Make the hub **extensible**: a central **widget registry** (developer-extensible — add a widget = register one descriptor + component) feeding a **user-composable dashboard** (responsive drag + resize grid). Existing screens (KPI strip, Active Jobs, Asset tree, Hydraulics) become registered widgets; new mined modules (survey, well-control, reports, Power BI embeds) drop in the same way. This is the substrate for "add additional widgets as desired," and the surface the `frontend-design` pass then polishes.

## 2. Goals / Non-Goals

**Goals**
- A typed **WidgetDefinition** + a registry as the single extension point.
- A **composable dashboard**: add / remove / move / resize widget instances on a responsive grid.
- **Per-user persistence** of the dashboard via the `Repository` seam (localStorage-backed mock now, Supabase later).
- Migrate the 4 existing screens into widgets; stub the Report + Embed categories.
- Widgets reusable in two surfaces: dashboard card **and** full-page nav view.

**Non-Goals (this phase)**
- Real Supabase persistence (deferred — behind the same interface).
- Per-role/admin-curated workspaces (the model supports it later; v1 is per-user).
- Real Power BI / Teams / O365 embeds (stub widgets only).
- Cross-device sync (localStorage is per-browser until the Supabase adapter lands).

## 3. Widget descriptor + registry

**Descriptor** (types in `@valor/core`, `src/widgets/types.ts`):
```ts
type WidgetCategory = 'compute' | 'data' | 'report' | 'embed';

interface WidgetDefinition {
  id: string;                 // stable key, e.g. 'hydraulics'
  title: string;
  description: string;
  category: WidgetCategory;
  defaultSize: { w: number; h: number };   // grid units
  minSize?: { w: number; h: number };
  // configSchema?: per-instance settings (e.g., scoped well/job) — optional, additive later
}
```
**Web registry** (`apps/web/lib/widgets/registry.ts`): a map of `id → { def: WidgetDefinition; Component: React.ComponentType<WidgetProps> }`. API: `registerWidget(def, Component)`, `getWidget(id)`, `listWidgets()`. Each widget module self-registers (imported by a barrel `widgets/index.ts`). Components are web-only, so the *component* registry lives in `apps/web`; the *descriptor type* is shared from `@valor/core`.

`WidgetProps = { config?: unknown; surface: 'card' | 'page' }` — a widget can adapt density to its surface.

## 4. Dashboard model

- Grid: **`react-grid-layout`** (responsive, drag + resize). One breakpoint config; collapses to single column on mobile.
- A dashboard is `DashboardLayout { id, ownerId, widgets: WidgetInstance[] }` where
  `WidgetInstance { instanceId, widgetId, layout: { x, y, w, h }, config? }`.
- Interactions: **+ Add widget** → catalog (grouped by category) → append an instance at a default slot; **drag/resize** → updates `layout`; **✕** → remove; **⚙** → edit `config` (when a widget declares one). Every change persists (debounced).
- A **default layout** (KPI + Active Jobs + Asset tree + Hydraulics) seeds first-run.

## 5. Persistence (repository seam)

Add to the `Repository` interface:
```ts
getDashboard(ownerId: string): Promise<DashboardLayout | null>;
saveDashboard(layout: DashboardLayout): Promise<void>;
```
- **MockRepository:** persists to `localStorage` (key `valor:dashboard:<ownerId>`) when running in the browser; falls back to in-memory on the server. Returns the default layout when none is stored.
- The dashboard page is a **client component** (react-grid-layout needs the client), so load/save run client-side where `localStorage` exists.
- **SupabaseRepository** (later) implements the same two methods against a `dashboards` table — no UI change.

`DashboardLayout` / `WidgetInstance` types live in `@valor/core` (`src/widgets/types.ts`); `ownerId` = `DEMO_USER_ID` until auth lands.

## 6. Widget chrome + reuse

- `WidgetCard` (`apps/web/components/widgets/widget-card.tsx`): header (icon · title · drag-handle · ⚙ · ✕) over the widget body; Valor dark/gold/glass styling.
- Each existing screen is refactored so its core renders as a widget `Component`; the **full-page nav route** renders the same component with `surface='page'`. No duplicate logic.

## 7. Add-widget catalog

`apps/web/components/widgets/widget-catalog.tsx`: a modal/drawer listing `listWidgets()` grouped by category (Calculators · Data · Reports · Embeds), each with icon + description + **Add**. Adding appends a `WidgetInstance` with the widget's `defaultSize`.

## 8. v1 scope & migration

Build:
1. `@valor/core`: `WidgetCategory`, `WidgetDefinition`, `WidgetInstance`, `DashboardLayout` types + a `createDefaultDashboard()` helper; `Repository` gains `getDashboard`/`saveDashboard`; `MockRepository` implements them (localStorage-backed).
2. `apps/web`: registry, `WidgetCard`, `WidgetCatalog`, the dashboard page (`/dashboard`, react-grid-layout) — add/remove/move/resize + persist.
3. **Migrate 4 widgets:** `kpi-strip`, `active-jobs`, `asset-tree`, `hydraulics` → `WidgetDefinition` + registered component; keep their full-page routes rendering the same components.
4. **Stub widgets:** one `report` (e.g., "Daily Report — coming soon") + one `embed` ("Power BI — coming soon") to prove all four categories.
5. `/dashboard` becomes the landing (`/` redirects there); existing nav routes remain for full-page views; add a "Dashboard" nav item.

## 9. Architecture / file structure
```
packages/core/src/widgets/types.ts        # descriptor + dashboard types + createDefaultDashboard()
packages/core/src/repository.ts           # + getDashboard / saveDashboard
packages/core/src/mock-repository.ts      # localStorage-backed impl
apps/web/lib/widgets/registry.ts          # register / get / list
apps/web/components/widgets/
  widget-card.tsx                          # chrome
  widget-catalog.tsx                       # add-widget picker
  dashboard.tsx                            # react-grid-layout host (client)
apps/web/widgets/                          # one file per widget: def + component + self-register
  kpi-strip.widget.tsx, active-jobs.widget.tsx, asset-tree.widget.tsx,
  hydraulics.widget.tsx, daily-report.stub.tsx, power-bi.stub.tsx
  index.ts                                 # imports all (registration side-effects)
apps/web/app/(hub)/dashboard/page.tsx      # renders <Dashboard/>
```

## 10. Testing (to standard)
- **Core (Vitest):** widget-types/registry integrity (unique ids, valid categories, defaultSize present); dashboard logic (add/remove/move/resize; `createDefaultDashboard`); persistence round-trip (`saveDashboard`→`getDashboard` via mock adapter with a localStorage shim).
- **Web (RTL/jsdom):** `WidgetCard` chrome (title/⚙/✕), catalog lists registered widgets by category, dashboard renders instances + add/remove updates the grid.
- Then **comprehensive review → resolve → test-after-resolution** (gates 5–7) + dimensioned CodeRabbit.

## 11. Front-end design
After the architecture lands, run the **`frontend-design` skill** over the dashboard, widget chrome, and catalog to bring them to the Valor dark/gold/glass bar (consistent density, drag affordances, empty states, responsive collapse).

## 12. Risks / open questions
- **`react-grid-layout` + React 19/Next 15:** verify compatibility at plan time; fall back to a lightweight CSS-grid + dnd-kit reorder (no free resize) if needed.
- **Client vs server data:** the dashboard is client-side (localStorage); existing server-component reads are unchanged. When Supabase lands, dashboard writes move to a server action.
- **Widget config schema:** kept optional/additive in v1 (only the dashboard layout + widget identity persist); per-instance config (e.g., scope a Jobs widget to one asset) is a fast follow.
