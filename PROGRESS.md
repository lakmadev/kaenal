# Kaenal Build Progress

> Read this file FIRST in every session. Resume from "Current status" — never re-plan from scratch.
> Update it in the SAME commit as the work it describes.

## Current status

**Phase 0 — Foundation, in flight.** The data plane is real and proven: docker stack runs,
migrations apply, the RLS schema lint passes over 32 tenant tables, and the tenancy suite passes
197 assertions across two seeded tenants (`acme`, `globex`). Both nets were mutation-tested —
they genuinely fail when isolation is broken.

**Next task:** `packages/core` (state machines + SLA math, pure + unit-tested), then `withAudit`
in `packages/db`, then the NestJS API skeleton with the request lifecycle from 01 §3.3.
Nothing user-visible ships until `withAudit` exists, because rule 3 (audit event per mutation,
in-transaction) cannot be retrofitted onto services written without it.

### How to get running from a cold clone

```bash
corepack enable && pnpm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # postgres:16 (5433), redis:7 (6380), minio (9000/9001)
pnpm db:migrate               # apply migrations/*.sql in order
pnpm db:check                 # RLS schema lint — must pass
pnpm provision-tenant --slug acme --name "Acme Manufacturing" --model shared
pnpm test:rls                 # tenancy suite — must pass
```

Ports are shifted off the defaults (5433/6380) so the stack can coexist with any Postgres or
Redis already running locally.

---

## Phase 0 — Foundation

- [x] **Monorepo scaffold** (2026-07-20) — Turborepo + pnpm workspaces, `apps/*` + `packages/*`
      per 01 §1. `apps/` not yet created (no app code yet).
- [x] **`packages/config`** (2026-07-20) — strict TS base config. `exactOptionalPropertyTypes`,
      `noUncheckedIndexedAccess` and friends are on; no `any` in committed code.
- [x] **`packages/types` — enums** (2026-07-20) — every domain enum as a Zod enum with its literal
      tuple exposed, so DB CHECK constraints derive from the same list (01 §4). Tenant slug
      validation + reserved list.
- [x] **Docker compose stack** (2026-07-20) — postgres:16, redis:7, minio, all healthchecked.
- [x] **Migrations + RLS** (2026-07-20) — `0000_foundation.sql` (extensions, `uuidv7()`, roles,
      control schema, `apply_tenant_rls()`), `0001_core.sql` (32 tenant tables).
- [x] **RLS schema lint** (2026-07-20) — `pnpm db:check`, 02 §6. Verifies tenant_id NOT NULL,
      RLS enabled AND forced, `tenant_isolation` policy with USING + WITH CHECK, and a
      tenant_id-leading index. Mutation-tested: a table without RLS fails it.
- [x] **Tenant provisioning script** (2026-07-20) — `pnpm provision-tenant`, 01 §3.4. Idempotent,
      seeds SLA config + default plant + example template + admin invite, runs an RLS smoke test
      before declaring the tenant ready, parks at `provisioning_failed` on any error.
- [x] **RLS / tenancy test suite** (2026-07-20) — 08 §1.1. 197 assertions. Tables enumerated
      dynamically from `pg_catalog`; a table with no fixture fails the suite rather than being
      skipped. Mutation-tested against both a dropped policy and a `USING(true)` leak.
- [ ] **`packages/core`** — state machines (02 §4), `computeDueAt` SLA math, scoring, supplier
      weighting. Pure, no Node/React imports. NEXT UP.
- [ ] **`withAudit` helper** (02 §3, 07 §1) — repo methods must be impossible to call without an
      audit event argument. Table + immutability triggers already exist and are tested.
- [ ] **Auth** — sessions, invitations, lockout (10 fails → 15 min), password reset. Schema
      (`users`, `sessions`, `memberships`) is in place; no logic yet.
- [ ] **Drizzle schema mirror** — typed query layer over the hand-written SQL (see Decision 2).
- [ ] **`apps/api` skeleton** — NestJS + the 01 §3.3 request lifecycle as middleware.
- [ ] **CI (GitHub Actions)** — install → typecheck → lint → unit → `db:check` → `test:rls` →
      build → Playwright smoke, per 01 §5.
- [ ] **ESLint + `eslint-plugin-boundaries`** — enforce the dependency direction from 01 §1.
- [ ] **Offboarding script** (01 §3.5) — export to S3, 30-day grace, legal-hold block.

## Phase 1 — Core loop (backend, then frontend)

Backend, in vertical slices (schema → contract → service → tests) one entity at a time:

- [ ] ts-rest contracts in `packages/types/src/contracts/` + OpenAPI 3.1 at `/v1/openapi.json`
- [ ] Request lifecycle middleware: resolve tenant → authenticate → scoped tx → RBAC guard
- [ ] RBAC guards from the 03 §3 matrix (+ plant scoping for inspector/viewer)
- [ ] Cursor pagination, idempotency keys, optimistic concurrency (`STALE_WRITE`) — 03 §5–6
- [ ] Inspections (templates, dynamic form engine, completion validation server-side)
- [ ] Findings → NCR creation flow
- [ ] NCR (state machine, four-eyes verify, SLA fields)
- [ ] CAPA (phase advance, explicit audited revert)
- [ ] Documents (+ versions, approval flow)
- [ ] Files (presign → upload → complete → AV scan gate) — 03 §7
- [ ] Search / FTS + federated `/v1/search` for the command palette
- [ ] Notifications
- [ ] `packages/api-client` — typed client + TanStack Query hooks

Frontend (only after the backend slice for a module is green):

- [ ] Next.js app shell — sidebar, topbar, command palette (04 §3)
- [ ] Design tokens from `implementation/reference/tokens.css`
- [ ] Dashboard → Inspections → NCR → CAPA → Documents
- [ ] All six UI states on every list/detail (04 §6)

## Phase 2 — Depth
- [ ] 8D workflow (step gating: N requires 1..N-1, D3 may parallel D2)
- [ ] Audits + audit findings
- [ ] BullMQ jobs: SLA escalation, notifications, scheduled reports
- [ ] Reports / exports (async jobs, 100k row cap → chunked zip)
- [ ] SPC / FMEA, scheduling & recurrence

## Phase 3 — Mobile
- [ ] Expo field-inspector app
- [ ] Offline SQLite + sync queue with conflict resolution (05)

## Phase 4 — Platform
- [ ] AI gateway + copilots (+ governance, region lock, budget gates)
- [ ] Supplier portal
- [ ] Public API + webhooks (HMAC signing, retry ladder)
- [ ] SSO/SCIM via WorkOS
- [ ] Add-on entitlements

---

## Decisions log

- **2026-07-20 — Spec location differs from CLAUDE.md.** CLAUDE.md and the kickoff prompt describe
  `implementation/` at the repo root; the files actually live at
  `project_brain/project/implementation/` (with `reference/` alongside). Left them in place rather
  than moving committed files. All spec references in this file use the real paths.
  *Affects: CLAUDE.md ground-truth section.* See Conflicts below.

- **2026-07-20 — Hand-written SQL migrations, not drizzle-kit generate.** The security-critical
  DDL (`FORCE ROW LEVEL SECURITY`, policies, role grants, append-only triggers, the published-
  template trigger) has no representation in the Drizzle schema DSL and would be dropped from a
  generated diff. SQL is the source of truth for anything the database enforces; a Drizzle schema
  mirror will be added for typed queries only. *Affects: 02 §5.*

- **2026-07-20 — `uuidv7()` implemented in plpgsql.** Postgres 16 has no built-in `uuidv7()`
  (that lands in PG18). Wrote an RFC 9562-compliant version using `gen_random_bytes`. Drop it when
  the platform moves to PG18 — semantics are identical. *Affects: 01 §4.*

- **2026-07-20 — RLS applied via `apply_tenant_rls(regclass)`, driven from one table list.**
  Repeating the policy DDL per table invites drift and omissions. One function + one list means a
  table either gets the full contract or visibly isn't in the list. `check-rls.ts` verifies the
  *result* from `pg_catalog` independently, so the two nets stay genuinely independent (08 §1.1).
  *Affects: 02 §1, §6.*

- **2026-07-20 — `users` is tenant-owned with `unique(tenant_id, email)`.** Follows 02 §2 verbatim.
  This means one person at two customers is two user rows, and the multi-tenant membership
  described in 07 §7 resolves by email at sign-in rather than by a shared user row. Keeps the
  "every table is tenant-owned" invariant total, which is what makes the dynamic RLS enumeration
  sound. *Affects: 02 §2, 07 §7 — see Conflicts.*

- **2026-07-20 — Non-default local ports (postgres 5433, redis 6380).** Avoids collisions with
  developers' existing local services. *Affects: 01 §2.*

- **2026-07-20 — `audit_events` exempt from the generic write probes.** It fails UPDATE/DELETE with
  "permission denied" before RLS is consulted, which is a stronger guarantee than "0 rows
  affected". Asserted directly in a dedicated block instead. *Affects: 08 §1.1.*

- **2026-07-20 — Four-eyes rule also enforced as a DB CHECK.** `packages/core` will reject it with
  a friendly `409`, but `ncrs_four_eyes_ck` means no code path — job, sync replay, support tool —
  can bypass it. *Affects: 02 §4.*

---

## Known issues / TODO

- **Model B (dedicated instance) provisioning is unimplemented.** `provision-tenant --model
  dedicated` exits with a clear error. Needs per-tenant DB creation + the migration fan-out with
  per-tenant locking (01 §3.4, 02 §5).
- **Invite tokens are printed but not persisted.** `provision-tenant` prints an invite link; the
  token isn't stored or verifiable until the auth module lands (03 §2). The seeded admin user sits
  at `status='invited'` with no credential, so nothing is currently loginable — intended.
- **`kaenal_public` role has no grants yet.** Correct for now (02 §1 says none by default), but the
  public-route paths in 01 §3.3 need revisiting when auth ships.
- **API-level cross-tenant probes not written** (08 §1.1 items 4–5: foreign id in body → 404,
  search/export/WS channel probes). Blocked on the API existing. Do not mark 08 §1.1 complete until
  these land — the DB-level suite is necessary but not sufficient.
- **No CI yet**, so the two nets only run locally. Wire GitHub Actions before any further schema work.
- **Question (out of scope, not built):** `FEATURES.md` describes modules (graph explorer,
  predictive, trust center, dev platform) that have no `implementation/` spec section. Treating them
  as Phase 4+ and not designing schema for them yet.

## Conflicts found (project_brain vs implementation/)

- **Spec path** — CLAUDE.md says `implementation/` is at the repo root; it is actually at
  `project_brain/project/implementation/`. Recorded as Decision 1. Worth fixing CLAUDE.md, or
  moving the specs to the root, at the user's preference.
- **User identity model** — 02 §2 specifies `users.email` unique *per tenant* (implying a user row
  per tenant); 07 §7 describes one person holding membership in multiple tenants and picking a
  workspace at sign-in (implying a shared user row). Per the ground-truth rule, `implementation/`
  wins and both statements are in `implementation/`, so resolved in favour of the more concrete
  one (02 §2 schema) — see Decision 5. **Flag for the user:** if true shared identity across
  tenants is wanted, `users` must move to the `control` schema and the auth design changes
  materially. Cheaper to settle before the auth module than after.
- `project_brain/README.md` is a Claude Design handoff note ("read Kaenal.html in full", "ask
  before implementing"). It describes the design-bundle workflow, not this build. Superseded by
  CLAUDE.md and `implementation/` — noted so a future session doesn't mistake it for instructions.
