# Review Pipeline & Merge Checklist

How every plan/feature branch in this repo gets from implementation to merge. This layers an
automated AI PR review (**CodeRabbit**) on top of our in-session subagent reviews.

## The layered gates

Each task and branch passes through these gates in order. A later gate never starts until the
earlier one is green.

1. **TDD implementation** — per task: write the failing test → confirm it fails → implement →
   confirm it passes → commit. (`superpowers:test-driven-development`)
2. **Spec-compliance review** (in-session subagent) — independently verifies the code matches the
   task/spec: nothing missing, nothing extra. Reads code + re-runs tests; does not trust reports.
3. **Code-quality review** (in-session subagent) — only after gate 2 is ✅. Checks separation of
   concerns, type safety, edge cases, file responsibility, and that tests verify real behavior.
4. **Final whole-branch review** (in-session subagent, most-capable model) — verifies the branch's
   Definition of Done end-to-end and that it integrates cleanly.
5. **CodeRabbit review** (GitHub App, automatic on PR) — fires on every push to an open PR.
   Triage its findings with the checklist below.
6. **Human review + merge** — the human gives the final approval and merges.

Gates 1–4 are the `superpowers:subagent-driven-development` loop. Gates 5–6 happen on the PR.

## CodeRabbit configuration (this repo)

- **Integration:** CodeRabbit GitHub App, installed org-wide; reviews automatically on PR open and
  on each push. No CLI needed.
- **Profile:** CHILL · **Plan:** Free.
- **Ignored paths:** `pnpm-lock.yaml` (lockfile noise).
- **Re-trigger manually** (if needed) by commenting on the PR: `@coderabbitai review` (incremental)
  or `@coderabbitai full review`.

### Fetching CodeRabbit findings for triage (no browser)

```bash
PR=<number>; REPO=<owner>/<repo>
# Actionable line comments (if any):
gh api repos/$REPO/pulls/$PR/comments --paginate \
  --jq '.[] | select(.user.login=="coderabbitai") | "### \(.path):\(.line)\n\(.body)\n---"'
# Summary + walkthrough + nitpicks (CHILL/Free often consolidates here):
gh pr view $PR --repo $REPO --json comments \
  --jq '.comments[] | select(.author.login=="coderabbitai") | .body'
```

## CodeRabbit triage checklist

For each CodeRabbit finding, decide and record one of:

- [ ] **Potential issue / bug** → fix on the branch (commit references the finding), or
- [ ] **Refactor / nitpick** → apply if it's a clear improvement; otherwise reply on the thread with
      a one-line justification for skipping (YAGNI, out-of-scope-this-plan, intentional), or
- [ ] **False positive / not applicable** → resolve the thread with a short reason.

Do not merge with un-triaged CodeRabbit findings. "Triaged" = fixed or explicitly justified.

## PR merge checklist (Definition of Ready to Merge)

- [ ] All unit tests pass (`corepack pnpm --filter @valor/core test`).
- [ ] App builds (`corepack pnpm --filter @valor/web build`); typecheck clean.
- [ ] In-session gates 2–4 (spec, quality, final) passed.
- [ ] CodeRabbit findings triaged (fixed or justified) per the checklist above.
- [ ] Docs updated if behavior/scope changed (README, spec, plan, this process doc).
- [ ] Security/RLS: when the change touches Supabase (Plan 4+), RLS policies have pgTAP tests and
      tenant isolation is proven — not assumed.
- [ ] Working tree clean; branch rebased/up to date with `master`.
- [ ] Human approval given.

## Where this applies in the plans

Every plan's "finish" step is: push the branch → CodeRabbit reviews → triage with the checklist
above → human merge. Plan docs reference this file rather than repeating the gates.
