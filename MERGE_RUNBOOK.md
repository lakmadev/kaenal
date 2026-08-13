# MERGE_RUNBOOK.md — how a branch reaches `main`

The process for turning a feature branch into a merge to `main`. It exists so a merge is
**never** "looks done, click the button" — every merge clears the same gates in the same order.
Read `CI.md` first (the pre-push gate); this file is the wrapper around it for the merge itself.

> Rule of thumb: **`main` is always green and always deployable.** A red check is a blocker, not
> a warning — never merge through a failing or skipped required check, never `--admin`-override a
> branch-protection gate to get a red PR in.

## The gate order (do not skip, do not reorder)

1. **Understand the failure before touching code.** Pull the failing check's log
   (`gh pr checks <pr>`, `gh run view <run-id> --log-failed`) and find the *actual* error line,
   not the container teardown noise at the tail. Name the root cause in one sentence before you
   edit anything.
2. **Fix at the root, generally.** If a probe/harness breaks on one table/case, fix the harness
   for the whole class, don't special-case the one input. Adding a table to an *exemption* list to
   silence an isolation test is a hole, not a fix (see `packages/db/src/tenant-tables.ts` — that
   list may only grow with a written justification).
3. **Local pre-push gate** (`CI.md` §1): `pnpm typecheck && pnpm lint`.
4. **Isolation nets when DB/schema/API changed** (`CI.md` §3): `pnpm db:migrate && pnpm db:check &&
   pnpm test:rls`. The tenancy suite (`test:rls`) is the highest-priority test in the repo — it
   must be **green**, not "known red". If it's red, the merge stops here.
5. **Affected test suites** green (`pnpm test`, or the specific `--filter` package). Distinguish a
   real failure from the documented local-only noise (`CI.md` §4–5): the flaky
   `scoped-transaction` ECONNRESET and the local demo-seed teardown FK are re-run/ignore, not fix.
6. **Commit** — small, conventional, tests ship with the code. Every commit message ends with:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
7. **Push** the feature branch. Never commit straight to `main`.
8. **Watch CI on the PR** until the required check(s) pass: `gh pr checks <pr> --watch`. CI runs the
   same steps as the local gate; if it went green locally it goes green here (modulo §4 flake).
9. **Merge only when green.** Confirm `mergeStateStatus` is `CLEAN` (not `UNSTABLE`/`BLOCKED`) and
   `mergeable` is `MERGEABLE`. Then merge (`gh pr merge <pr> --squash` unless the PR is a curated
   multi-commit history worth preserving — this program's PR #5 is, so `--merge`).
10. **Close the loop.** Link/close any tracking issue the failure had (e.g. issue #6 for the red
    `test:rls`), and update `PROGRESS.md` "Current status" in the same push if status changed.

## PR #5 specifics (Data Platform A–F + G–K → `main`)

- **Why it was red:** the `verify` job's `pnpm test:rls` aborted in `beforeAll` with
  `column "id" does not exist` (Postgres `42703`). `packages/db/test/rls.test.ts` addressed every
  probe row by a single-column `id`, but `tenant_settings` (Phase A) has a composite PK
  `(tenant_id, namespace)` and no `id` column, so the whole suite crashed (299 tests, all skipped).
  Compounding it: 12 tenant tables added across Phases A–K were never seeded in
  `packages/db/test/fixtures.ts`, so their isolation was never actually probed.
- **The fix (root, general):** the suite now discovers each table's **primary-key columns** and
  addresses probe rows by that key, so composite-PK tables work; `fixtures.ts` seeds all 49 tenant
  tables. Tracked in issue #6.
- **Merge style:** `--merge` (preserve the curated commit history), base `main`.
