# CI.md — make CI pass before you push

**Run the pre-push gate below before every push.** CI (`.github/workflows/ci.yml`) runs the
exact same steps; if they pass locally they pass in CI (the one exception is a known flaky
test — see §4). This file exists because CI kept going red on things that a 30-second local
check would have caught.

## 1. The fast pre-push gate (run this every time)

These two catch every **deterministic** CI failure we've hit, need no Docker, and take ~10s:

```bash
pnpm typecheck && pnpm lint
```

- `pnpm typecheck` → `turbo run typecheck` (all 6 workspaces, strict TS, no `any`).
- `pnpm lint` → `eslint .` (dependency-direction boundaries, no-`any`, React/Next rules).

If both pass, push. If you also touched DB/API behaviour, run the full suite too (§3).

## 2. What CI runs, in order (and the local command for each)

CI: install → **typecheck → lint** → migrate → db:check → test:rls → provision tenants →
**test → build**. Locally:

| CI step | Local command | Needs Docker? |
|---|---|---|
| Typecheck | `pnpm typecheck` | no |
| Lint | `pnpm lint` | no |
| Migrate | `pnpm db:migrate` | yes (postgres) |
| RLS schema lint | `pnpm db:check` | yes |
| Tenancy isolation suite | `pnpm test:rls` | yes |
| Provision test tenants | `pnpm provision-tenant --slug acme … && … globex …` | yes |
| Tests | `pnpm test` | yes (postgres + redis) |
| Build | `pnpm build` | no |

CI env: **Node 20**, `NODE_ENV=test`, Postgres 16 + Redis 7 service containers (no MinIO —
file tests use a fake or offline S3 signing). Non-secret CI creds are inlined in `ci.yml`.

## 3. Full local reproduction (when you touched DB/API/build)

```bash
docker compose up -d                 # postgres:5433, redis:6380, minio
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint
pnpm db:migrate && pnpm db:check && pnpm test:rls
pnpm test                            # unit + integration (serial, shared PG)
pnpm build
```

> Local uses ports 5433/6380 (see `.env`); CI uses 5432/6379 inside its runner. That's why the
> DB URLs differ between `.env` and `ci.yml` — don't "fix" one to match the other.

## 4. Known non-deterministic failure — re-run, don't debug

`apps/api/test/scoped-transaction.test.ts` → *"keeps tenant scope correct under concurrent
interleaved requests"* occasionally fails with **`read ECONNRESET`**. It's a flake in how that
one concurrency test tears down pg connections, not a real regression. **If CI fails ONLY on
this test, re-run the job** (`gh run rerun <run-id>` or the "Re-run failed jobs" button). Do not
try to fix it as part of unrelated work. (Tracked in memory `flaky-scoped-transaction-test`.)

## 5. Local-only test noise that does NOT affect CI

Running `pnpm test` locally can show `auth.test.ts` / `audits.test.ts` as "failed suites" with
**every test passing** — a teardown FK violation from the local **demo seed** (a demo NCR's
`resolved_by` / an audit finding's `capa`). CI has no demo seed, so it never hits this. If you
see it locally, ignore it; don't change teardown to chase it. (See `TROUBLESHOOTING.md`.)

## 6. Lessons that have bitten CI (add to this list when a new one does)

- **Root config files must be lint-ignored.** `eslint.config.js` ignores `*.config.{js,ts,mjs,cjs}`.
  A new root config with a different extension (or a plain `.cjs`/`.mjs` script) that isn't in any
  `tsconfig` makes the typed linter fail with *"was not found by the project service"*. Either add
  its glob to `ignores` or include it in a tsconfig. (This is what broke CI when
  `ecosystem.config.cjs` landed.)
- **New files that import workspace packages** must respect the dependency direction
  (`types ← core ← db/api-client ← apps`; web/mobile may never import `db`). `pnpm lint` enforces it.
- **`pnpm build` is stricter than dev** (Next production build, `tsc` emit). Run it when you touch
  the web app or API build config, not just `dev`.

## TL;DR

```bash
pnpm typecheck && pnpm lint   # before every push
# + `docker compose up -d && pnpm test && pnpm build` when you touched DB/API/build
# CI red on ONLY scoped-transaction.test (ECONNRESET)? → just re-run the job.
```
