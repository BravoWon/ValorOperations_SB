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
5. **Comprehensive phase review (value × context × intent)** — at phase completion, a world-class
   ("AAAA, no budget constraints") multi-dimensional pass. Every change is *dimensioned* on three
   axes — **value** (intended operational worth), **context** (fit with the ops goal + the system),
   and **intent alignment** (expected-vs-delivered for the phase) — alongside deep technical +
   application review and an IP/brand-leak scan. Run via the CodeRabbit App (dimensioned by
   `.coderabbit.yaml`) **plus** an in-session comprehensive review pass (most-capable model) that
   mirrors the CodeRabbit CLI's depth. Output includes expected-vs-delivered gaps and a recommended
   test-after-resolution suite.
6. **Resolve** — fix (or explicitly justify) every finding from gate 5.
7. **Test-after-resolution** — *after* resolution is confirmed, add tests that prove the resolved
   behavior (the suite recommended in gate 5: compute robustness, registry/units integrity, and
   panel/UI guards). Re-verify everything green.
8. **Human review + merge** — the human gives the final approval and merges.

Gates 1–4 are the `superpowers:subagent-driven-development` loop. Gates 5–8 happen at phase
completion on the PR.

## AI PR review — CodeRabbit + Copilot (this repo)

- **Maximum adherence (b.jones directive): treat every bot assessment as a structured _return_ we
  action by default.** Each CodeRabbit / Copilot finding is a **leveling element** that brings
  **semantic coherence between the request (intent) and the artifact (code)** across both **surface**
  (UX / appearance) and **structure** (architecture). The default action on a finding is **fix**; skip
  only with an explicit one-line justification posted on the thread (YAGNI / out-of-scope-this-slice /
  false-positive). Run **both** bots on every PR, **re-request review after each push**
  (`@coderabbitai review`), and **never merge with un-actioned findings**. The correction loop *is* the
  alignment mechanism: request → assessment → action → re-verify → coherent artifact.
- **Two bots review every PR:** the **CodeRabbit** GitHub App and **GitHub Copilot** code review —
  both automatic on PR open + each push. Triage findings from both with the checklist below.
- **Credit fallback:** CodeRabbit is on the Free plan (limited credits/quota). **If CodeRabbit credits
  run out, GitHub Copilot becomes the primary PR-review bot** (it has produced useful findings on
  prior PRs), and the in-session comprehensive review (gate 5) holds the review depth regardless of
  either bot's availability.
- **Best model fit per task:** in-session work selects the least-powerful-sufficient model — a fast
  model for mechanical implementer tasks, the most-capable model for the gate-5 comprehensive review
  and any architecture/design work. Switch models per tasking as needed.
- **CodeRabbit integration:** GitHub App, installed org-wide; reviews automatically on PR open and
  on each push. (Bot login is `coderabbitai[bot]` when fetching comments via the API.)
- **Dimensioned by `.coderabbit.yaml`** (repo root): `profile: assertive`, plus tone + path
  instructions that steer the review onto **value / context / intent alignment**
  (expected-vs-delivered), with a hard **IP guardrail** (no brand/product/personnel/client/well/
  location names; generic restated math only) for `packages/core`, and brand/a11y/adapter-seam
  checks for `apps/web`.
- **CLI:** the CodeRabbit CLI is macOS/Linux/WSL-only (its installer has no native-Windows path), so
  on Windows we use the App + the in-session comprehensive pass (gate 5); run the literal CLI from
  WSL/Mac if desired.
- **Ignored paths:** `pnpm-lock.yaml` (lockfile noise).
- **Re-trigger manually** on a PR: `@coderabbitai review` (incremental) or `@coderabbitai full review`.

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
- [ ] Comprehensive phase review (value × context × intent) passed; all findings resolved.
- [ ] Test-after-resolution suite added and green (`@valor/core` + `@valor/web`).
- [ ] Docs updated if behavior/scope changed (README, spec, plan, this process doc).
- [ ] Security/RLS: when the change touches Supabase (Plan 4+), RLS policies have pgTAP tests and
      tenant isolation is proven — not assumed.
- [ ] Working tree clean; branch rebased/up to date with `master`.
- [ ] Human approval given.

## Where this applies in the plans

Every plan's "finish" step is: push the branch → CodeRabbit reviews → triage with the checklist
above → human merge. Plan docs reference this file rather than repeating the gates.
