# Valor Operations Hub

Oilfield E&P operator operations hub — job setup, lifecycle + stage execution tracking,
and org/asset consolidation. See `docs/superpowers/specs/` for the design and
`docs/superpowers/plans/` for implementation plans.

## Monorepo
- `packages/core` — domain types, transition/field-validation logic, the repository
  interface, and the in-memory mock adapter (frontend-first; the Supabase adapter lands in
  Plan 4). Zod schemas for the forms/server-action layer arrive with Plan 3.
- `apps/web` — Next.js 15 web app (the operations hub UI).

## Develop
```bash
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm test          # run @valor/core unit tests
pnpm dev           # start the web app at http://localhost:3000
```
