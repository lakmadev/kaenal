# Kaenal Build Progress

> Read this file FIRST in every session. Resume from "Current status" — never re-plan from scratch.
> Update it in the SAME commit as the work it describes.

## Current status

**Phase 0 done; Phase 1 core loop under way.** Data plane, business logic, audit plumbing, the
request lifecycle, authentication, the contract layer AND the first vertical slice (Inspections)
are done and proven, and CI runs them on every push/PR. 701 tests pass (233 db integration, 380
core unit, 63 api integration, 25 types unit); all four packages typecheck under strict TS and lint
clean. The RLS schema lint covers 32 tenant tables. The isolation nets, DST math, dependency
direction, request lifecycle, composite member FKs, lockout durability, CSRF and the sliding-window
limiter were all mutation-tested.

`apps/api` authenticates (httpOnly session cookie + double-submit CSRF, or mobile bearer) and now
serves a **contract-first** API: the ts-rest contract in `packages/types/src/contract.ts` is the
single source for both the OpenAPI 3.x doc at `GET /v1/openapi.json` and the typed web client.
Handlers validate against the contract's own Zod schemas.

**Inspections slice (03 §1, §5–6; 02 §4; 08 §1.2):** templates (create draft → publish, schema
immutable once published), inspections (schedule from a published template with a server-minted
`INS-YYYY-NNNN` code → start → complete). Completion validates responses AND computes the score
server-side via the `packages/core` form engine — the client never sends a score. Cross-cutting
guarantees all landed and tested: cursor pagination, idempotent create (`Idempotency-Key`, Redis),
optimistic concurrency (`lock_version` compare-and-set → `STALE_WRITE`), plant scoping (out-of-scope
record → 404 not 403), RBAC per capability.

**Rate limiting (03 §9):** Redis sliding-window limiter — 60 rpm/user (in the lifecycle, after
auth) and 5/min per-IP on the credential endpoints (the credential-stuffing gap lockout could not
close). Off by default only in `NODE_ENV=test`; `RATE_LIMIT_ENABLED` overrides.

**Next task:** Findings → NCR creation flow, then NCR (state machine + four-eyes verify + SLA
fields) — schema → contract → service → tests. Web app shell (04) proves DB→API→UI; sign-in +
inspections/templates screens exist (`apps/web`), full design system deferred.

### How to get running from a cold clone

```bash
corepack enable && pnpm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # postgres:16 (5433), redis:7 (6380), minio (9000/9001)
pnpm db:migrate               # apply migrations/*.sql in order (through 0003)
pnpm db:check                 # RLS schema lint — must pass
pnpm provision-tenant --slug acme --name "Acme Manufacturing" --model shared
pnpm provision-tenant --slug globex --name "Globex" --model shared   # api tests need both
pnpm test                     # full suite (serial: shares one DB) — 670 tests
```

The api integration tests resolve real tenants and seed members, so `acme` and `globex` must be
provisioned first. `pnpm test` is `turbo run test --concurrency=1` — do not parallelise it; the
suites share one Postgres.

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
- [x] **`packages/core` — state machines** (2026-07-20) — NCR, inspection, CAPA, document (02 §4)
      as declarative graphs + guards. 199 tests covering the FULL (from, to) matrix per entity,
      legal and illegal, plus four-eyes, corrective-action gating, open-8D force-close, document
      self-approval, and last-approved-version protection.
- [x] **`packages/core` — SLA math** (2026-07-20) — `addBusinessHours` / `computeDueAt` /
      `computeSlaState` / `businessHoursBetween` in tenant timezone + business hours. 30 tests
      including DST in both directions, weekends, holidays, half-hour offsets. Mutation-tested:
      a naive wall-clock window implementation fails the spring-forward case.
- [x] **`packages/core` — entity codes** (2026-07-20) — `formatCode`/`parseCode`/`counterYear`,
      25 tests including year rollover in the tenant's timezone (02 §7).
- [x] **`withAudit` helper** (2026-07-20) — 02 §3, 07 §1. Wraps a mutation so the change and its
      audit events commit or roll back together; refuses a mutation recording zero events; redacts
      credential-shaped fields; `diffFields` stores only what changed. 22 integration tests against
      real Postgres, including both rollback directions.
- [ ] **`packages/core` — scoring + supplier weighting + recurrence** (08 §1.2) — dynamic-form
      scoring with conditional items/N-A/zero-weight sections, supplier weighted score
      (normalise weights, weight 0 excludes, missing metric flagged not zeroed), recurrence
      expansion (Feb 29, month-end). Not needed until the inspections/suppliers slices.
- [x] **Shared identity migration** (2026-07-20) — `0003_shared_identity`: `users` → `control.users`,
      per-tenant profile onto `memberships`, every user reference repointed to a composite FK to
      `memberships (tenant_id, user_id)` via a `pg_constraint`-driven loop, plus `invitations`
      (tenant-owned) and `control.password_resets`. 14 explicit tests in `control-identity.test.ts`
      (the table is outside the RLS lint), mutation-tested against a single-column FK.
- [x] **Auth** (2026-07-20) — 03 §2, 07 §4. argon2id credentials, tenant-scoped sessions
      (httpOnly cookie + double-submit CSRF; mobile bearer), invitations (7-day single-use,
      re-invite invalidates), lockout (10 → 15 min, counter + audit written OUTSIDE the request tx
      so they survive the rejection), password reset (30-min single-use, kills all sessions),
      uniform failure envelope so login is not an enumeration oracle. Policy math lives in
      `packages/core/src/auth-policy.ts` (26 unit tests); the wiring is `apps/api/src/auth/*` with
      48 api integration tests. The real `SessionAuthenticator` is now bound at `AUTHENTICATOR`.
- [ ] **Drizzle schema mirror** — typed query layer over the hand-written SQL (see Decision 2).
- [x] **`apps/api` skeleton** — NestJS + the 01 §3.3 request lifecycle. Tenant resolution
      (subdomain + `X-Tenant-Id`, Redis-cached registry), scoped transaction, RBAC guard, error
      envelope (03 §4), `/healthz` + `/readyz` (03 §9), `GET /v1/me`, graceful shutdown.
      Authentication is a stubbed provider — see Known issues.
- [x] **RBAC capability matrix** (03 §3) in `packages/core/src/rbac.ts`, incl. plant scoping and
      the four-eyes rule. Full role x capability grid asserted cell by cell.
- [x] **CI (GitHub Actions)** — `.github/workflows/ci.yml`: install → typecheck → lint →
      migrate → `db:check` → `test:rls` → unit/integration tests → build, against postgres:16 and
      redis:7 service containers. Playwright smoke still pending (no web app yet).
- [x] **ESLint + `eslint-plugin-boundaries`** — root flat config enforcing the 01 §1 dependency
      direction, plus no-`any` and a Node-builtin ban in `core`/`types`.
- [ ] **Offboarding script** (01 §3.5) — export to S3, 30-day grace, legal-hold block.

## Phase 1 — Core loop (backend, then frontend)

Backend, in vertical slices (schema → contract → service → tests) one entity at a time:

- [x] ts-rest contract in `packages/types/src/contract.ts` + OpenAPI at `/v1/openapi.json`
      (2026-07-21). `@ts-rest/nest` deliberately NOT used — see Decisions log.
- [x] Request lifecycle middleware: resolve tenant → authenticate → scoped tx → RBAC guard
      (Phase 0; authentication is now the real `SessionAuthenticator`, not a stub)
- [x] RBAC guards from the 03 §3 matrix (+ plant scoping for inspector/viewer) — matrix, helpers
      AND now APPLIED: inspections list/get fold plant scope into the query / 404 (2026-07-21)
- [x] Cursor pagination, idempotency keys, optimistic concurrency (`STALE_WRITE`) — 03 §5–6
      (2026-07-21) — `apps/api/src/http/{pagination,idempotency}.ts`, `lock_version` (migration 0004)
- [x] Inspections (templates, dynamic form engine, completion validation + scoring server-side)
      (2026-07-21) — `packages/core/src/form-engine.ts` + `apps/api/src/inspections/*`
- [x] Rate limiting: Redis sliding window, 60 rpm/user + 5/min per-IP login (2026-07-21, 03 §9)
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

- **2026-07-21 — contract-first via ts-rest, but WITHOUT `@ts-rest/nest`.** The contract lives in
  `packages/types` and drives the OpenAPI doc (`@ts-rest/open-api`) and the typed web client
  (`@ts-rest/core` `initClient`). The Nest handlers are plain controllers that validate against the
  contract's Zod schemas, rather than `@ts-rest/nest`'s `@TsRestHandler`. Reason: the whole request
  lifecycle is ONE interceptor running inside the tenant-scoped transaction (see the Phase-0
  decision), and `@ts-rest/nest` wants to own request handling in a way that fights the
  AsyncLocalStorage + `withTenant` chain. Keeping the contract as the shared artifact gets the
  contract-first guarantee (client and server can't drift) without surrendering the lifecycle.
  *Affects: 03 §1.*

- **2026-07-21 — optimistic concurrency is a real `lock_version int` column (migration 0004), not
  `updated_at`.** A trigger bumps it on any real UPDATE, so no code path can move a row without
  advancing the token; services compare-and-set `WHERE id = $ AND lock_version = $expected` and map
  zero rows to `STALE_WRITE`. `inspection_templates.version` already means the published template
  version, so the concurrency token is a separate column. *Affects: 03 §6, 02 §7.*

- **2026-07-21 — the score is computed server-side and the client's is ignored.** `completeInspection`
  takes responses + a version, never a score. `packages/core/form-engine.ts` validates responses
  against the pinned template version and computes the weighted score; weight 0 and N/A drop an item
  from the denominator rather than counting as zero. A client-sent score is a number a customer could
  forge. *Affects: 08 §1.2, 02 §4.*

- **2026-07-21 — idempotency is Redis-backed, not a table.** `Idempotency-Key` on a create is checked
  before the tenant transaction opens; `SET NX` closes the check-then-mark race so two concurrent
  retries can't both proceed (the loser gets CONFLICT). A failed mutation clears the marker so it
  stays retryable. A DB idempotency table is the stronger form; revisit if replay-after-restart
  durability is needed. *Affects: 03 §6.*

- **2026-07-21 — rate limiting is a sliding log (ZSET), and EVERY hit is logged, including a rejected
  one.** So hammering while blocked pushes the window forward — a deliberate penalty for brute force.
  Enforced at two keys: `user:{tenant}:{userId}` (60/min, in the lifecycle after auth) and
  `login:{ip}` (5/min, on the credential routes — the credential-stuffing gap per-account lockout
  cannot close). Gated by `RATE_LIMIT_ENABLED`, which defaults on except in `test` because the
  suites fire hundreds of requests as one user in one second. *Affects: 03 §9.*

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

- **2026-07-20 — SUPERSEDED — `users` was tenant-owned with `unique(tenant_id, email)`.** Followed
  02 §2 verbatim. Reversed the same day by the decision below once auth made the cost concrete.
  Left here so the reversal is legible.

- **2026-07-20 — identity is SHARED: `users` moved to `control.users` (0003).** Chose 07 §7 over
  02 §2. 07 §7's workspace switcher and cross-tenant invites are specified product behaviour that
  per-tenant user rows cannot deliver; the reverse (shared rows, single membership) degrades
  gracefully. Cost: `users` leaves the dynamic RLS enumeration, so it carries its own explicit
  access tests. The guarantee RLS used to give — no cross-tenant user references — is replaced by
  a composite FK `(tenant_id, col) → memberships (tenant_id, user_id)` on every referencing
  column, so the constraint can only be satisfied by a member of the SAME tenant. The FK is
  driven off `pg_constraint` in the migration so a column added later is not silently missed.
  *Affects: 02 §2, 07 §7, 03 §10.*

- **2026-07-20 — the request lifecycle has three access levels, default-deny.** `@Public` (no
  tenant, no session — health), `@AllowAnonymous` (tenant + scoped tx, no session — sign-in,
  accept-invite, which must read/write tenant rows under RLS without a credential), and the
  default (session required, optional `@RequireCapability`). A route with no decorator 401s, so a
  forgotten guard fails closed. *Affects: 01 §3.3, 03 §2.*

- **2026-07-20 — sign-in failures write their audit event and lockout counter OUTSIDE the request
  transaction.** Every failure path throws, and a throw rolls the request transaction back — which
  would erase the very record of the failed attempt and reset the counter, so lockout would never
  engage. Both go through the control pool / a separate `withTenant`. Mutation-tested: routing the
  counter through the request tx makes the lockout test fail. *Affects: 03 §2, 07 §1.*

- **2026-07-20 — every auth failure returns the SAME envelope** (`UNAUTHENTICATED`, "Email or
  password is incorrect"), whether the cause is unknown email, wrong password, locked account, or
  a valid credential for a tenant the person is not a member of. Distinguishing them turns the
  login form into an account/membership enumeration oracle — and tenant membership is exactly the
  cross-tenant existence rule 8 forbids leaking. Unknown accounts also spend a dummy argon2 verify
  to flatten timing. *Affects: 03 §2, rule 8.*

- **2026-07-20 — `pnpm test` runs packages serially (`--concurrency=1`).** All integration tests
  share one Postgres, and the db-package suites TRUNCATE shared tables (incl. `control.users`),
  which corrupts the api suite's fixtures when the two run in parallel. Serial + each suite
  seeding/cleaning its own data is the cheap fix; a per-package database or schema is the real one
  (Known issues). *Affects: 08 §1.*

- **2026-07-20 — Non-default local ports (postgres 5433, redis 6380).** Avoids collisions with
  developers' existing local services. *Affects: 01 §2.*

- **2026-07-20 — `audit_events` exempt from the generic write probes.** It fails UPDATE/DELETE with
  "permission denied" before RLS is consulted, which is a stronger guarantee than "0 rows
  affected". Asserted directly in a dedicated block instead. *Affects: 08 §1.1.*

- **2026-07-20 — Four-eyes rule also enforced as a DB CHECK.** `packages/core` will reject it with
  a friendly `409`, but `ncrs_four_eyes_ck` means no code path — job, sync replay, support tool —
  can bypass it. *Affects: 02 §4.*

- **2026-07-20 — `packages/core` returns `Decision` values, never throws for domain rules.** A
  denial carries an `ErrorCode` + `details`, which the API maps onto the 03 §4 envelope. Keeps core
  free of HTTP concepts so it runs unchanged in the browser and React Native. Genuine
  misconfiguration (business hours with no working days) still throws — that's a bug, not a
  domain outcome. *Affects: 03 §4, 01 §1.*

- **2026-07-20 — Business time is consumed as ELAPSED hours, not wall-clock hours.** On a
  spring-forward day an 08:00–17:00 shift is 8 real hours, not 9. Since the shop floor works clock
  hours, consuming elapsed time is the honest reading of "resolve within 24 business hours".
  Verified against independently-confirmed DST facts. *Affects: 03 §10, 08 §1.2.*

- **2026-07-20 — `at_risk` threshold set to 80% of the SLA window consumed.** The spec names the
  three states (02 §2) but not the boundary. Exported as `AT_RISK_THRESHOLD`; make it a tenant
  setting if customers ask. *Affects: 02 §2.*

- **2026-07-20 — NCR graph additions beyond the literal spec text.** 02 §4 does not say what
  follows `escalated`, or what happens when verification rejects the work. Added
  `escalated → {assigned, in_progress, resolved}` (escalation is a flag on a live NCR, not a dead
  end) and `resolved → in_progress` (verification can bounce work back without a close/reopen
  round trip). *Affects: 02 §4 — flag if either is wrong.*

- **2026-07-20 — `audit_events.action` gained a CHECK constraint (migration 0002).** 0001 created
  it as free text, so a typo'd action could enter an append-only table where it can never be
  corrected. Found by a `withAudit` test that expected the invalid write to fail. 01 §4 requires
  enum columns to carry a CHECK generated from the same list as `packages/types`.
  *Affects: 01 §4, 02 §3.*

- **2026-07-20 — `@kaenal/db` tests run with `fileParallelism: false`.** They are integration
  tests against one real database and several TRUNCATE shared tables. TRUNCATE is unavoidable
  because `audit_events` is append-only (DELETE is denied to the app role and blocked by a
  trigger), so the only reset is table-wide as the owner. Serial execution is the cost of testing
  real guarantees instead of a mock. *Affects: 08 §1.*

- **2026-07-20 — one root ESLint flat config, not per-package configs.** The rule that matters
  most (01 §1 dependency direction) is invisible from inside any single package, so it has to be
  evaluated from the root. `pnpm lint` is now `eslint .` rather than `turbo run lint`, which had
  been matching zero packages and reporting green. *Affects: 01 §1, 01 §5.*

- **2026-07-20 — `eslint-import-resolver-typescript` is mandatory for the boundaries rule.**
  Without a resolver, `boundaries/element-types` cannot map `@kaenal/db` back to `packages/db`,
  so every cross-package rule silently passes. Found by mutation test (a `core → db` import was
  NOT flagged until the resolver was added), not by reading the docs. If the resolver is ever
  removed, the dependency-direction net dies silently. *Affects: 01 §1.*

- **2026-07-20 — CI service-container credentials are inline in `ci.yml`.** They belong to an
  ephemeral container that exists for one job and is reachable only from it, so they are not
  secrets and putting them in GitHub Secrets would imply otherwise. Real environments take every
  value from the deployment platform's secret store (01 §2). *Affects: 01 §2, 01 §5.*

- **2026-07-20 — the whole request lifecycle is ONE interceptor, not middleware + guards.**
  Nest runs guards before interceptors, so the conventional split would run authentication and the
  RBAC membership lookup OUTSIDE the transaction that scopes them — unscoped reads on a connection
  with no `app.tenant_id`, which is exactly what RLS exists to constrain. Keeping the chain inside
  `withTenant` makes every query of a request, including the ones deciding whether it is allowed,
  subject to the same tenant policy. *Affects: 01 §3.3, 03 §3.*

- **2026-07-20 — routes are default-deny.** Anything not marked `@Public` requires a session,
  whether or not it declares a `@RequireCapability`. Forgetting the decorator on a new route
  yields a 401, not an open endpoint. *Affects: 03 §3.*

- **2026-07-20 — `emitDecoratorMetadata` is OFF in `apps/api`; all DI uses explicit
  `@Inject(TOKEN)`.** esbuild (tsx, vitest) cannot emit decorator metadata, so type-based
  injection would typecheck under `tsc` and then resolve to `undefined` at runtime — a failure
  that appears only when a code path is first exercised. Explicit tokens remove the class of bug
  rather than adding a build step to work around it. *Affects: 01 §1.*

- **2026-07-20 — the tenant registry caches MISSES as well as hits**, for the same 60s TTL. The
  subdomain is attacker-controlled and unauthenticated, so without negative caching a burst of
  requests for non-existent tenants is a free amplification vector against the registry.
  *Affects: 01 §3.2.*

- **2026-07-20 — RBAC capabilities live in `packages/core`, not in the API guard.** Three
  consumers need the same answer and must never disagree: the guard (enforcement), `GET /v1/me`
  (what the UI renders), and the clients (what they hide). The list handed to a client is a
  rendering hint; enforcement is always server-side. *Affects: 03 §3, rule 5.*

---

## Known issues / TODO

- **Model B (dedicated instance) provisioning is unimplemented.** `provision-tenant --model
  dedicated` exits with a clear error. Needs per-tenant DB creation + the migration fan-out with
  per-tenant locking (01 §3.4, 02 §5).
- **The provisioned admin has no credential and no persisted invite.** `provision-tenant` still
  prints a throwaway invite link that is not stored — the seeded admin sits at membership
  `status='invited'` with no password. To make a tenant loginable, an existing admin must issue a
  real invite via `POST /v1/auth/invite`. Bootstrapping the FIRST admin (no admin exists yet to
  invite them) is unsolved: provisioning should persist a real invitation row and print its token.
  Tracked for the provisioning pass.
- **No email delivery.** `POST /v1/auth/invite` and `/forgot-password` return the one-time token
  in the response body OUTSIDE production so flows are testable; in production they return nothing
  and the token must be emailed. Until an email job exists (06), these flows are not usable in a
  production deploy. The token is never logged.
- **`kaenal_public` role has no grants yet.** Correct for now (02 §1 says none by default), but the
  public-route paths in 01 §3.3 need revisiting when auth ships.
- **API-level cross-tenant probes not written** (08 §1.1 items 4–5: foreign id in body → 404,
  search/export/WS channel probes). Blocked on the API existing. Do not mark 08 §1.1 complete until
  these land — the DB-level suite is necessary but not sufficient.
- **Sessions are opaque tokens, not JWTs.** 03 §2 describes the web session as an "encrypted JWT,
  12h, sliding refresh". Implemented instead as a random token whose SHA-256 is stored in
  `sessions`, looked up per request. Simpler, revocable server-side (a JWT is not), and the sliding
  window is enforced on lookup. If a stateless JWT is later required for scale, it is a change to
  `resolveSession`/`signIn` only. The 12h TTL slides on `slideSessionExpiry` at issue but is NOT
  yet re-slid on each request — add that when session activity tracking lands.
- **Deactivating a membership does not proactively kill live sessions.** `resolveSession` re-checks
  `membership.status = 'active'` on every request, so a deactivated user is locked out on their
  next call (07 §7 role re-evaluation) — but any long-poll/socket already open is not torn down.
  Fine for REST; revisit with realtime (06).
- **`GET /v1/me` returns a minimal shape** (userId, tenantSlug, role, capabilities). 03 §3 will
  want more (name, plants, tenant display name) once the web shell needs it.
- **Model B (dedicated) request routing throws INTERNAL.** The lifecycle refuses to serve a
  tenant whose registry row says `dedicated` rather than falling through to the shared pool.
  Loud failure is deliberate — the quiet version puts a dedicated tenant's data in the shared DB.
- **The control-plane pool uses the migrator connection string** (`DATABASE_URL`), and auth now
  READS AND WRITES `control.users` / `control.password_resets` / cross-tenant `sessions` through
  it (sign-in, lockout counters, password reset revoking every session). Migration 0003 grants
  `kaenal_app` SELECT/INSERT/UPDATE (never DELETE) on the control identity tables, so a dedicated
  least-privilege `kaenal_registry`/`kaenal_auth` role could replace the migrator pool here and
  should before production — the migrator is a superuser and this is more reach than the API needs.
  Tracked so it is not forgotten.
- **Rate limiting DONE** (2026-07-21, 03 §9): Redis sliding window, 60 rpm/user + 5/min per-IP on
  the credential routes. Remaining nuance: the per-user limit is enforced *after* the tenant tx
  opens (it is keyed on the authenticated user), so a flood still pays for tenant resolution + a
  BEGIN before being rejected; acceptable, but a pre-tx per-IP global cap would shed load earlier.
- **`equalizeTiming` only flattens the unknown-account path.** It spends a dummy argon2 verify when
  the email is unknown, but the locked / wrong-password / no-membership branches have their own
  (real) argon2 or query costs, which are close but not identical. Good enough against coarse
  timing; a determined side-channel attacker is out of scope for now.
- **Per-package test isolation is by convention, not enforced.** All suites share one Postgres;
  `pnpm test` runs serially and each suite seeds/cleans its own fixtures, but nothing PREVENTS a
  new suite from truncating a table another depends on. The real fix is a database or schema per
  package (or per worker). Revisit if the suite grows or flakes.
- **Playwright smoke is not in CI** (01 §5) — nothing to smoke-test until `apps/web` exists. Add
  the job with the first web route, not before; an empty browser job is a green check that means
  nothing.
- **CI has no staging/production deploy stage yet** (01 §5 second half: migrate → deploy, expand →
  migrate → contract). Deliberate — there is no deploy target. Revisit at the end of Phase 1.
- **No enum-drift lint yet.** 01 §4 wants DB CHECK value lists generated from `packages/types`.
  They are currently hand-mirrored, and migration 0002 exists precisely because one was missed.
  Write `packages/db/scripts/check-enums.ts` to compare `pg_constraint` value lists against the
  exported enum tuples and fail CI on drift — the enums already expose `.values` for this.
- **`sla_configs.entity_kind` / `priority` have no CHECK constraints**, same class of gap as the
  one 0002 fixed. Roll into the enum-drift lint rather than patching ad hoc.
- **A survived mutation, now fixed — recorded because the lesson generalises.** The original
  "rejects a deeper subdomain" test used `a.acme.kaenal.local` and passed against a deliberately
  broken `split(".")[0]` host parser, because tenant `a` does not exist so both parsers 404. The
  test asserted the right outcome for the wrong reason. Replaced with
  `acme.attacker.kaenal.local` — a REAL tenant as the leading label — which fails against the
  broken parser. When writing a negative test, check that the fixture can distinguish the bug
  from an unrelated reason for the same status code.
- **The fall-back DST test does not discriminate** against the naive wall-clock mutation (both
  implementations agree there, because 12h fits inside both a 12h and a 13h window). The
  spring-forward test is the one carrying the weight. Kept both as regression cover.
- **Question (out of scope, not built):** `FEATURES.md` describes modules (graph explorer,
  predictive, trust center, dev platform) that have no `implementation/` spec section. Treating them
  as Phase 4+ and not designing schema for them yet.

## Conflicts found (project_brain vs implementation/)

- **Spec path** — CLAUDE.md says `implementation/` is at the repo root; it is actually at
  `project_brain/project/implementation/`. Recorded as Decision 1. Worth fixing CLAUDE.md, or
  moving the specs to the root, at the user's preference.
- **User identity model — RESOLVED 2026-07-20 in favour of 07 §7 (shared identity).** 02 §2
  specified `users.email` unique *per tenant*; 07 §7 described one person across tenants with a
  workspace picker. Both are in `implementation/`, so the ground-truth rule did not settle it — the
  user chose shared identity. `users` moved to `control.users` in migration `0003`; every tenant
  reference is a composite FK to `memberships`. See the two Decisions-log entries and
  `control-identity.test.ts`. Left here as a record that the conflict existed and how it closed.
- `project_brain/README.md` is a Claude Design handoff note ("read Kaenal.html in full", "ask
  before implementing"). It describes the design-bundle workflow, not this build. Superseded by
  CLAUDE.md and `implementation/` — noted so a future session doesn't mistake it for instructions.
