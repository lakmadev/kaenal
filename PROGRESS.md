# Kaenal Build Progress

> Read this file FIRST in every session. Resume from "Current status" — never re-plan from scratch.
> Update it in the SAME commit as the work it describes.

## Current status

**Phase 0 done; Phase 1 backend COMPLETE; Phase 2 nearly done (jobs + 8D + Audits + Exports + Scheduling).** Data
plane, business logic, audit plumbing, the request lifecycle, authentication, the contract layer, all
five Phase-1 vertical slices (Inspections, Findings → NCR, CAPA, Documents, Files), federated Search,
Notifications, the typed `@kaenal/api-client`, the BullMQ jobs runtime (SLA escalation, AV scan,
notification delivery, async exports, recurring-inspection scheduling, document-expiry reminders), the
8D workflow, the Audits
module, async Reports/exports, scheduling/recurrence AND document-expiry reminders are
done and proven, and CI runs them on
every push/PR. 858 tests pass (239 db integration, 442 core unit, 141 api integration, 25 types unit,
11 api-client unit); all five workspaces typecheck under strict TS and lint clean. The RLS schema lint covers 33 tenant
tables. The isolation nets, DST math, recurrence expansion, dependency direction, request lifecycle, composite member FKs,
lockout durability, CSRF, plant-scope 404 (rule 8, one level down), NCR four-eyes, CAPA
forward-only/revert directionality and the document rules (approver-role, self-approval four-eyes,
last-approved-version protection) were all mutation-tested (the CAPA and document rules via the full
(from, to) matrix in core) — proven to fail when the guard is disabled. The rate limiter and the
file AV-scan download gate have behavioural tests (allow/deny paths), not a formal mutation.

**Document-expiry slice (06 `docs`):** the daily `docs` BullMQ queue
(`documentExpiryCheckForTenant`, fanned out per active tenant) reminds a controlled document's owner
as its `expires_at` approaches — at 90, then 30, then 7 days out. The "which reminder is due now"
decision is pure + unit-tested in `packages/core/document-expiry.ts` (`activeExpiryThreshold` returns
the smallest crossed threshold — the most urgent applicable notice — so a doc created already inside a
window gets only that window's reminder; 5 unit tests). The processor scans only `approved` documents
within the 90-day horizon (riding the `documents_tenant_expires_idx`) and notifies via the dedupe-safe
`NotificationsService.notify` with key `(document, threshold)`, so the daily re-run never re-sends and
a doc escalates to the next window only once. No new schema (documents already carry `expires_at`, and
`CreateDocumentBody` already sets it); notifications are a delivery artifact, so no audit events. 3 api
tests (threshold selection + skip-outside-window, idempotent re-run, no-owner skip) + 5 core; the
`docs` queue is the sixth in the jobs runtime.

**Scheduling/recurrence slice (02 §2, 06 `schedule`, 08 §1.2):** a recurring inspection is a series
head carrying a `recurrence` rule (`{freq: daily|weekly|monthly, interval, byweekday[], until}`); the
hourly `schedule` BullMQ queue (`materializeScheduleForTenant`, fanned out one job per active tenant
like the SLA sweep) expands each head into occurrence inspections 14 days ahead. The calendar math is
pure + unit-tested in `packages/core/recurrence.ts` (`expandOccurrences`), with the traps the spec
calls out pinned: a 31st clamps to each month's last day, a Feb-29 anchor lands on Feb 28 in non-leap
years (never Mar 1), weekly honours `byweekday` and skips inactive weeks at interval > 1 — 13 unit
tests. Materialisation is idempotent on `(series_id, occurrence_date)` (migration 0012 adds those
columns + a unique partial index; the hourly re-run only creates days newly in the window), audited as
a `system` actor and recorded only on a real insert. `POST /v1/inspections` accepts `recurrence` to
make a head; `PUT /v1/inspections/:id/recurrence` sets/changes/clears it (optimistic concurrency; an
occurrence can't carry its own → 409); `GET /v1/inspections/:id/occurrences` lists a series' occurrences,
plant-scoped by role (rule 8). Occurrences inherit the head's template/plant/inspector and carry a
freshly minted `INS-YYYY-NNNN`. 4 api tests (expand + idempotent re-run, clear-stops-materialising,
stale/occurrence-recurrence 409s, plant-scope 404); `seed:demo` materialises a weekly series. The
`schedule` queue is the fifth in the jobs runtime.

**Reports/exports slice (03 §8, 06 `reports`):** a large export is an async job, not a synchronous
response. `POST /v1/exports {resource, format}` records a `queued` row and returns **202**; the new
`reports` BullMQ queue renders it server-side (`run-export` processor), uploads the artifact to object
storage, and flips the row to `completed`; the client polls `GET /v1/exports/:id`, which mints a
short-TTL presigned download URL once the object exists (`GET /v1/exports` lists your own, paginated).
The two rules the spec pins live pure + unit-tested in `packages/core/exports.ts`: RFC-4180 CSV
quoting, and the **100k-row cap → a zip of chunked CSVs** (`chunkRows`/`toCsv`, 10 unit tests). The
processor plant-scopes by re-deriving the requester's membership and querying through the SAME tenant
tx, so an export is not a way to read rows the requester can't see; table/column selection comes only
from a fixed `EXPORTABLES` map (ncrs/inspections/capas/audits), never request input. Exports are
scoped to their requester (a foreign export is a 404 — rule 8), because the snapshot was plant-scoped
to whoever asked. You can only export a resource you may VIEW (the `<resource>:view` capability, checked
in the service since it depends on the body). Creation is audited (`created`); each presigned URL mint
is the data egress, audited `exported` like a file download. CSV is the built renderer; XLSX/PDF are
future renderers behind the same pipeline (the `ExportFormat` enum is the slot). `run-export` is
idempotent (claims the `queued` row → `processing`; a retry finds it non-queued and skips); failures
land as `status='failed'` with the message. Storage grew a server-side `put`; migration 0011 (the
first brand-new tenant table after 0003 → explicit composite member FK). 6 api tests (202→render→poll,
idempotency, zip split, plant scope, requester 404, own-only list) + the 10 core; `zip` via `fflate`.
The demo seed renders one completed NCR export against real MinIO.

**Audits slice (02 §2, 03 §3, 07 module):** audits run through fixed phases
(planned → preparation → fieldwork → reporting → closed, forward-only `auditMachine`), accumulate
findings (`audit_findings`: clause/kind/description), and each finding can spawn an NCR or a CAPA —
the same corrective seam as inspection findings, linking `audit_findings.ncr_id`/`capa_id` and
delegating to `NcrService`/`CapaService` so codes, SLA and audit events stay consistent (NCR source =
`audit`, CAPA sourceKind = `audit_finding`; double-raise → 409). Audits are plant-scoped (inspector/
viewer see only their plants → 404); a new `audit:view` capability reads (everyone), `audit:manage`
(admin/manager/auditor) schedules/advances/records/raises. `lock_version` (migration 0010). 7 api
tests + 4 core (phase machine); `AUD-YYYY-NNNN`.

**8D slice (02 §4, 03 §10):** the eight-discipline problem-solving workflow. The gating rule lives in
`packages/core/eight-d.ts` — a step is completable only once its prerequisites are, strictly in order
EXCEPT that D3 may run parallel to D2 (so D3's only prerequisite is D1); mutation-testable, 9 unit
tests. The service (`apps/api/src/eight-d/*`) stores the disciplines as a `steps` jsonb, gates each
completion, and mints `8D-YYYY-NNNN`. The headline seam is 8D↔NCR: an 8D opened from an NCR links it
(`ncrs.eight_d_id`) and — while `active` — blocks that NCR from closing (the dormant `openEightDId`
path in `ncrMachine`, now wired: `NcrService` resolves it to null once the 8D is completed/cancelled).
Not plant-scoped; rides the NCR capabilities (`ncr:view`/`ncr:manage`) since the matrix has no 8D row.
`lock_version` (migration 0009). 6 api tests incl. the full close-blocked → resolve → close flow.

**BullMQ jobs runtime (06 §1):** a worker process (`pnpm --filter @kaenal/api worker`) separate from
the API, with six queues wired: `sla` (repeatable every-5-min sweep → fans out one `recomputeSla`
job per active tenant → reclassifies open NCRs against their SLA window with the core business-time
math, escalates breaches through `ncrMachine`, audits as a `system` actor, notifies the owner),
`files` (`scanFile` → a pluggable `Scanner` port flips `scan_status`; infected notifies the uploader),
`notify` (`deliverNotification` → a `DeliveryChannels` port fans an in-app row to
email/push/SMS per the user's `notification_prefs`, recording `channels_sent`), and `reports`
(`runExport` → renders a requested export server-side and uploads it via the `Storage` port; see the
Reports/exports slice), `schedule` (repeatable hourly sweep → fans out one
`materializeSchedule` job per tenant → expands recurring inspection series into occurrences; see the
Scheduling slice), and `docs` (repeatable daily sweep → fans out one `documentExpiryCheck` job per
tenant → reminds owners of documents nearing expiry; see the Document-expiry slice). Scanner +
delivery are stub ports (no ClamAV/Resend yet); the plumbing, DB
effects and idempotency are real. The API only
ENQUEUES, behind a `JOBS_ENABLED` gate — off in `test` (a `NoopProducer`, no queue connection), so the
HTTP suites never touch BullMQ; `FilesService.complete` enqueues a scan, `NotificationsService.notify`
enqueues a delivery, and `ExportsService.create` enqueues a render (the `sla`/`schedule` sweeps are
worker-internal repeatables, not API-enqueued). Job rules per 06: 5× exponential
backoff, `jobId` dedupe, failed jobs retained as
a dead-letter set. 6 tests — each processor against real Postgres (escalate/scan/deliver + idempotency)
and a real BullMQ enqueue→process round-trip against the test Redis.

**`@kaenal/api-client` (03 §1, 01 §1):** the typed client the FE (and mobile) consume. `createApiClient`
wraps ts-rest `initClient` over the shared contract and threads the API's conventions through a custom
fetcher: `X-Tenant-Id`, cookie-vs-bearer auth, and double-submit CSRF (`kaenal_csrf` → `x-csrf-token`)
on unsafe cookie requests only. It is framework-agnostic (plain `fetch`, runs in browser/RN/server);
tenant + auth are resolvable getters so one instance follows the active workspace/session. TanStack
Query integration is v5 query-option factories (`apiQueries.ncrs.list(client, args) → {queryKey,
queryFn}`) + a `queryKeys` factory, rather than a hard dependency on React or a react-query major — the
FE feeds them to `useQuery`; mutations compose the client call with `unwrap`. 11 unit tests (request
wiring incl. CSRF/bearer/tenant-getter, non-2xx-as-data, key shapes, unwrap).

**Notifications slice (02 §2, 06):** the consumer API — `GET /v1/notifications` (cursor, unread
filter), `GET /v1/notifications/unread-count` (bell badge), `POST /v1/notifications/:id/read` +
`/read-all`, `GET`/`PUT /v1/notification-prefs` (the per-kind channel matrix) — all scoped to the
current user (a foreign notification is a 404, not a 403; rule 8). Plus `NotificationsService.notify`,
the dedupe-safe write primitive (`ON CONFLICT (tenant_id, dedupe_key) DO NOTHING`) the producing side
will call inside an event's own transaction. Notification rows are a delivery artifact, not an
audited business entity, so this slice deliberately does NOT go through `withAudit`. Producing
notifications on events (NCR assigned, SLA breach) and email/push/SMS fan-out are the Phase-2 `notify`
job (06); no migration (the tables + dedupe index pre-existed).

**Search slice (03 §1, 04 command palette):** one `GET /v1/search?q=` federates full-text search
across inspections, NCRs, CAPAs and documents, ranked over each entity's generated `search_vector`
(code A / title B / description C, migration 0008), top 6 per kind. Plant scoping mirrors the list
endpoints (a plant-bound inspector/viewer sees only in-scope inspections/NCRs); RLS confines every
query to the caller's tenant, so search is not a cross-tenant oracle (rule 8). Authenticated-only —
every role holds the four `*:view` capabilities.

**Files slice (03 §7, 07 §3):** the three-step upload — `POST /v1/files/presign` (mime allowlist +
size cap in `packages/core/file-policy.ts`, a `pending` row, a short-TTL presigned PUT) → client
uploads to storage directly → `POST /v1/files/:id/complete` (server verifies the object exists,
re-checks its real size against the cap, records the hash). The security rule is the download gate
(`GET /v1/files/:id/download`): a file that is not `clean` is downloadable only by its uploader while
pending (watermarked client-side via a `scanPending` flag), and by no one once `infected`; every
successful download is audited (`file_downloaded`, 07 §1). Storage is a port (`Storage`) with a real
`S3Storage` adapter (MinIO locally, proven with a live round-trip) and a `FakeStorage` bound in
tests, so none of this needs a live bucket in CI. The AV scanner itself is a Phase-2 job — until it
runs, files stay `pending`. No migration (the `files` table already carried every column).

**Documents slice (02 §4, 03 §3):** controlled documents run draft → pending → approved|rejected,
approved → archived, rejected → draft, driven by `documentMachine`, which carries the three rules
that make a document "controlled": only an admin/manager reviews (`document:approve`), an author
cannot approve their own document (four-eyes), and the last approved version cannot be archived out
from under the shop floor. Authoring (create/submit/revise/archive/new-version) is a separate
`document:manage` capability; review (`POST /v1/documents/:id/review`, approve|reject) is its own
route so the second pair of eyes lands on a different person. A new version never moves the record
backward — `POST /v1/documents/:id/versions` opens a fresh draft `document_versions` row while the
approved version stays approved and auditable (`GET .../versions` is the history). Optimistic
concurrency via `lock_version` (migration 0007); documents are not plant-scoped.

**CAPA slice (02 §4, 03 §3):** corrective/preventive actions run as a phased programme
(initiation → root_cause → action_plan → implementation → verification → effectiveness → closed).
The one rule the spec singles out is directionality, and it is enforced as two separate endpoints:
`POST /v1/capas/:id/advance` moves exactly one phase forward (`capaMachine`), and
`POST /v1/capas/:id/revert` is the audited exception — earlier phase only, reason mandatory
(`canRevertCapa` + the body schema + an audit event). CAPAs are not plant-scoped (no plant_id
column), so every role holds a new `capa:view` (the "View all modules" row) while only `capa:manage`
mutates. CAPA actions carry their own pending→in_progress→done→verified status flow. Optimistic
concurrency via `lock_version` (migration 0006).

**Findings → NCR slice (02 §4, 03 §3, §10):** findings recorded against an inspection; NCRs raised
(optionally FROM a finding, which links it and defaults source/plant off the inspection). NCR
lifecycle driven by `ncrMachine` — the corrective-action gate (can't resolve without a done
corrective action), four-eyes verify (resolver ≠ verifier, enforced in the machine AND the
`ncrs_four_eyes_ck` DB CHECK), plant scoping, SLA due dates computed on creation in the plant's
timezone. Corrective/preventive actions with their own status flow. `verify` is a separate route
(cap `ncr:verify`) so auditors — who can verify but not manage — can reach it.

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

The API is browsable via **Swagger UI at `/v1/docs`** over the generated OpenAPI doc — there is no
web frontend in this repo (a dedicated FE is planned separately). `seed:demo` now also creates a
finding + an NCR raised from it, so the findings/NCR endpoints have data to show.

**Next task:** Phase 2's specified backend is now essentially complete (8D, audits, notifications,
reports/exports, scheduling/recurrence all done). **SPC / FMEA is deferred pending spec** — it is a
FEATURES bullet + a visual-only prototype (`src/qms-risk-spc.jsx`), but `implementation/02-DATABASE`,
`03-API` and `08-TESTING` define no tables, endpoints, or algorithms for it, so building it means
inventing the whole module (control-chart limits/Western-Electric rules, FMEA RPN, risk register,
MSA/Gauge R&R). Per the "no invented scope" rule that's a spec question, logged under Known issues,
not a silent build. The clear remaining backend work is the last two 06 queues (`housekeeping` — purge
soft-deleted > 90 days minus legal holds, audit-event partition roll; `ai` — the AI gateway chokepoint,
06 §3) and XLSX/PDF export renderers behind the existing `reports` pipeline. Real ClamAV +
email/push providers would replace the stub scanner/delivery ports. Suppliers/PPAP/SCAR is Phase 4.
The dedicated **FE** can also start against `@kaenal/api-client`.

### How to get running from a cold clone

```bash
corepack enable && pnpm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # postgres:16 (5433), redis:7 (6380), minio (9000/9001)
pnpm db:migrate               # apply migrations/*.sql in order (through 0012)
pnpm db:check                 # RLS schema lint — must pass
pnpm provision-tenant --slug acme --name "Acme Manufacturing" --model shared
pnpm provision-tenant --slug globex --name "Globex" --model shared   # api tests need both
pnpm test                     # full suite (serial: shares one DB) — 858 tests
```

The api integration tests resolve real tenants and seed members, so `acme` and `globex` must be
provisioned first. `pnpm test` is `turbo run test --concurrency=1` — do not parallelise it; the
suites share one Postgres.

**To browse the API (Swagger):**

```bash
pnpm --filter @kaenal/api seed:demo    # loginable admin + a template + 3 inspections in acme
pnpm --filter @kaenal/api dev          # API on :3001
# open http://localhost:3001/v1/docs   → Swagger UI over the generated OpenAPI doc
```

Swagger UI (`/v1/docs`) renders the OpenAPI document (`/v1/openapi.json`) generated from the
ts-rest contract, with the `X-Tenant-Id` header and a bearer scheme wired in so endpoints are
exercisable. To try authenticated routes: POST `/v1/auth/sign-in` with `X-Tenant-Id: acme` and
`demo@acme.test` / `demo-password-1234`, copy the `kaenal_session` cookie value, then **Authorize**
with it as the bearer token. The provisioned admin has no credential (Known issues), so `seed:demo`
is what makes the workspace loginable; it is dev-only and sets a known password.

There is no web frontend in this repo yet — a dedicated FE implementation is planned separately.
The typed client that FE will use is `initClient(contract)` from `@kaenal/types`.

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
- [x] Findings → NCR creation flow (2026-07-22) — `apps/api/src/ncr/findings.*`; raising an NCR
      from a finding links it and defaults source/plant off the inspection
- [x] NCR (state machine, four-eyes verify, SLA fields) (2026-07-22) — `apps/api/src/ncr/ncr.*`;
      transition + verify routes, corrective actions, SLA due dates, four-eyes mutation-tested
- [x] CAPA (phase advance, explicit audited revert) (2026-07-22) — `apps/api/src/capa/capa.*`;
      forward-only `advance` + audited `revert` (reason required), CAPA actions, migration 0006
- [x] Documents (+ versions, approval flow) (2026-07-22) — `apps/api/src/documents/documents.*`;
      lifecycle + review (four-eyes), version history (`document_versions`), new-version-resets-to-
      draft, keep-one-approved-version guard, migration 0007
- [x] Files (presign → upload → complete → AV scan gate) (2026-07-22, 03 §7) —
      `apps/api/src/files/*` + `packages/core/file-policy.ts`; `Storage` port (real `S3Storage`/MinIO
      + `FakeStorage`), download gated on scan status, no migration (files table pre-existed)
- [x] Search / FTS + federated `/v1/search` for the command palette (2026-07-22) —
      `apps/api/src/search/*`; generated `search_vector` columns + GIN (migration 0008), top 6/kind,
      plant-scoped
- [x] Notifications (2026-07-22) — `apps/api/src/notifications/*`; consumer API (list/unread-count/
      mark-read/read-all/prefs), per-user scoped, + the dedupe-safe `notify()` write primitive. No
      migration. Producers/delivery are the Phase-2 `notify` job.
- [x] `packages/api-client` — typed client + TanStack Query option factories (2026-07-22) —
      `createApiClient` (tenant/cookie-bearer/CSRF), `apiQueries` + `queryKeys`, framework-agnostic

Frontend — NOT in this repo. A dedicated FE implementation is planned separately; it will consume
the ts-rest contract via `initClient(contract)`. Until then the API is browsable via Swagger UI at
`/v1/docs`. (An earlier exploratory `apps/web` was removed — the ask was to visualise the API, not
to build the frontend.)

- [ ] Next.js app shell — sidebar, topbar, command palette (04 §3)
- [ ] Design tokens from `implementation/reference/tokens.css`
- [ ] Dashboard → Inspections → NCR → CAPA → Documents
- [ ] All six UI states on every list/detail (04 §6)

## Phase 2 — Depth
- [x] 8D workflow (step gating: N requires 1..N-1, D3 may parallel D2) (2026-07-22) —
      `packages/core/eight-d.ts` + `apps/api/src/eight-d/*`; gating, 8D↔NCR close-block, migration 0009
- [x] Audits + audit findings (2026-07-22) — `packages/core/state-machines/audit.ts` +
      `apps/api/src/audits/*`; phase machine, findings, raise-NCR/raise-CAPA seam, migration 0010
- [~] BullMQ jobs runtime (2026-07-22) — worker process + `sla` (escalation), `files` (AV scan),
      `notify` (delivery), `reports` (async export render), `schedule` (recurrence materialisation),
      `docs` (document-expiry reminders) queues DONE (`apps/api/src/jobs/*`); `housekeeping`/`ai`
      queues still pending
- [x] Reports / exports (2026-07-22) — `packages/core/exports.ts` + `apps/api/src/exports/*` +
      `apps/api/src/jobs/processors/run-export.ts`; 202 → `reports` render → presigned download,
      100k-row cap → chunked zip (`fflate`), plant-scoped + requester-scoped, migration 0011
- [x] Scheduling & recurrence (2026-07-22) — `packages/core/recurrence.ts` (expand incl. Feb 29 /
      month-end) + `inspections` service/controller + `apps/api/src/jobs/processors/materialize-schedule.ts`;
      hourly `schedule` queue, idempotent on `(series_id, date)`, migration 0012
- [x] Document-expiry reminders (2026-07-22) — `packages/core/document-expiry.ts` (90/30/7 threshold
      cascade) + `apps/api/src/jobs/processors/document-expiry.ts`; daily `docs` queue, dedupe on
      `(document, threshold)`, no schema change
- [ ] SPC / FMEA — deferred pending spec (see Known issues): no backend schema/API/algorithm in
      `implementation/`, only a FEATURES bullet + visual prototype

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

- **2026-07-22 — document-expiry reminders reuse the notification dedupe key, no new schema.** The
  `docs` job notifies at the *smallest* crossed threshold (90 → 30 → 7), so a document created already
  inside a window gets only that window's reminder, not the ones it skipped. Idempotency is the
  existing `(tenant_id, dedupe_key)` unique index with key `doc-expiry:{doc}:{threshold}` — the daily
  re-run re-sends nothing and a doc escalates to the next window exactly once. Only `approved`
  documents are scanned (a draft's expiry isn't "in effect"), bounded to the 90-day horizon so the
  scan rides `documents_tenant_expires_idx`. Like the rest of the notifications path it writes no audit
  events (a reminder is a delivery artifact). *Affects: 06 §1 `docs`.*

- **2026-07-22 — recurrence lives on `inspections`; occurrences are child rows; SPC/FMEA deferred.**
  The spec puts `recurrence` on the inspection row itself, so a recurring inspection is a "series head"
  (recurrence set, `series_id` null) and the `schedule` job materialises child occurrence rows
  (`series_id` = head, `occurrence_date` set) rather than a separate `inspection_series` table — no
  invented schema. Idempotency is a unique partial index on `(tenant_id, series_id, occurrence_date)`;
  the materialiser pre-checks existence so a re-run doesn't burn a code sequence, and the unique index
  still guards a genuine race. Occurrences are audited as a `system` actor, recorded only on a real
  insert (the withAudit event is written after confirming the ON CONFLICT insert returned a row).
  Expansion is UTC calendar-date math in core (DST is irrelevant to whole-day occurrences; a follow-up
  could localise the window to the plant tz). **SPC/FMEA was explicitly requested alongside scheduling
  but deferred**: `implementation/02,03,08` define no tables/endpoints/algorithms for it — only a
  FEATURES bullet and a visual-only prototype — so per "no invented scope" it is a spec question
  (Known issues), not a speculative build. *Affects: 02 §2, 06 `schedule`, 08 §1.2.*

- **2026-07-22 — exports are async jobs with their own artifact + requester scoping; CSV first.**
  `POST /v1/exports` → 202 + `queued` row; the new `reports` queue renders it and the client polls
  `GET /v1/exports/:id` for a presigned URL. Several choices worth recording: (1) the rendered file
  lives on the `exports` row (`bucket`/`object_key`), NOT in `files`, so it bypasses the AV-scan
  download gate that guards user uploads — an export is generated output, not an upload. (2) Exports
  are scoped to their requester (foreign → 404), not tenant-wide, because a completed export is a
  frozen snapshot that was plant-scoped to whoever asked; handing it to another user would leak rows
  outside their scope. (3) The processor re-derives the requester's membership and queries through the
  same tenant tx, so plant scope + RLS apply to the render exactly as to the list endpoint; table
  selection is a fixed `EXPORTABLES` map (never request input). (4) `ExportFormat` ships as `csv` only
  — XLSX/PDF (headless Chromium) are additional renderers behind the same pipeline; the contract
  advertises only what is built, so the FE never offers a format that 422s. (5) The 100k-row cap →
  chunked-zip and CSV quoting are pure `packages/core` functions (unit-tested), leaving the processor
  to I/O. Egress is audited where it happens: `created` at request, `exported` each time a presigned
  URL is minted (mirrors `file_downloaded`). `exports` is the first brand-new tenant table after 0003,
  so its user reference is a hand-written composite member FK. *Affects: 03 §8, 06 `reports`.*

- **2026-07-22 — audit findings reuse the corrective seam by delegating to `NcrService`/`CapaService`.**
  Rather than reimplement NCR/CAPA creation (code minting, SLA, audit events) inside the audits
  service, `AuditsService` is constructed with `NcrService` + `CapaService` and calls their `create`
  from within the same request transaction, then links `audit_findings.ncr_id`/`capa_id` with a
  `WHERE … IS NULL` compare-and-set (double-raise → 409) — the exact pattern inspection findings use.
  The NCR gets `source = 'audit'`, the CAPA `sourceKind = 'audit_finding'`. Added an `audit:view`
  capability (all roles, the "View all modules" row) alongside the existing `audit:manage`
  (admin/manager/auditor); audits are plant-scoped like NCRs/inspections. *Affects: 02 §2, 03 §3.*

- **2026-07-22 — 8D rides the NCR capabilities, and the NCR-close block now checks 8D status.** The
  03 §3 matrix has no row for 8D, and an 8D is the deep problem-solving ON an NCR (raised from it,
  gates its close), so 8D uses `ncr:view` (read) / `ncr:manage` (run) rather than inventing an
  `eightd:*` capability. The `openEightDId` guard in `ncrMachine` was wired long ago but always fed
  `ncrs.eight_d_id` verbatim; `NcrService` now resolves it to null unless the linked 8D is still
  `active`, so a completed/cancelled 8D correctly stops blocking the NCR. Consequence surfaced by the
  test: linking an 8D `UPDATE`s the NCR (`eight_d_id`), bumping its `lock_version` — a client holding
  the NCR must refetch before its next write. Step gating (D3∥D2) lives in `packages/core` as a pure
  function, mutation-testable. *Affects: 02 §4, 03 §3, §10.*

- **2026-07-22 — the jobs runtime is gated by `JOBS_ENABLED`, with a `NoopProducer` when off.** The
  API process only ENQUEUES; the worker (`pnpm --filter @kaenal/api worker`) consumes. Rather than
  couple the HTTP services to a live BullMQ connection, the producer is an interface bound to
  `NoopProducer` whenever jobs are disabled — the default in `test`, so no suite opens a queue
  connection or leaks one (same pattern as `RATE_LIMIT_ENABLED`). Processors are plain functions that
  open their OWN tenant-scoped transaction from the job's `tenantId` (06 §1 — a job is inside RLS just
  like a request) and take their collaborators as deps, so they're tested directly against Postgres;
  a separate case proves the BullMQ enqueue→process wiring against the test Redis. System-initiated
  writes (SLA recompute/escalation, scan verdict) audit with `actorKind: 'system'`, `actorId: null`.
  *Affects: 06 §1, 01 §3.3.*

- **2026-07-22 — AV scanning and channel delivery are PORTS with stub implementations.** `Scanner`
  (ClamAV in prod) and `DeliveryChannels` (Resend/Expo/Twilio in prod) are injected into their
  processors, exactly like the storage `Storage` port. The stubs make both outcomes exercisable
  without an engine or provider credentials (the stub scanner verdicts `infected` on an EICAR-marked
  filename; the stub delivery reports success), and the real DB effects — `scan_status` flip +
  uploader notification, `channels_sent` recorded per `notification_prefs` — are fully wired and
  tested. Swapping in real adapters is a provider change, not a pipeline change. *Affects: 06 §1,
  07 §3.*

- **2026-07-22 — `@kaenal/api-client` is framework-agnostic: query-option factories, not react-query
  hooks.** The shared client ships to both Next and Expo (and can run server-side), so baking in React
  or a specific `@tanstack/react-query` major would force a version and a runtime on every consumer.
  Instead it exports `createApiClient` (a plain-`fetch` ts-rest client) plus TanStack v5 query-OPTION
  factories (`apiQueries.x(client, args) → {queryKey, queryFn}`) + a `queryKeys` factory; the app feeds
  those to its own `useQuery`, and mutations are `client.x(...)` composed with `unwrap`. This is the
  pattern TanStack itself now recommends, keeps the package dependency-light (only `@kaenal/types` +
  `@ts-rest/core`, satisfying the boundaries `allow: ["types","core"]`), and stays node-testable (no
  jsdom). Tenant/auth/CSRF are threaded through a custom ts-rest fetcher so a single instance follows
  the active workspace/session; the package's tsconfig adds the `DOM` lib (it needs `fetch`/cookies),
  with a `typeof document` guard for React Native. If the FE later wants literal generated hooks,
  adding `@ts-rest/react-query` on top is a small, additive follow-up. *Affects: 03 §1, 01 §1.*

- **2026-07-22 — notifications are NOT audited, and this slice owns the consumer side only.**
  Notification rows are a delivery artifact — the downstream product of an already-audited event — and
  07 §1's "what gets logged" list does not include them, so `NotificationsService` deliberately does
  not route through `withAudit` (the one place a mutation legitimately skips it; marking-read and
  personal channel prefs are likewise personal state, not the tenant "settings changes" the audit list
  means). The slice ships the read/manage/prefs API + the `notify()` write primitive (dedupe-safe via
  the pre-existing `notifications_dedupe_uq` partial index); PRODUCING notifications on domain events
  and the email/push/SMS fan-out are the Phase-2 `notify` job (06, "on event"), kept out of the domain
  services so notification concerns don't smear across NCR/CAPA/Documents before the event layer
  exists. Everything is per-user scoped (a foreign notification id → 404, not 403; rule 8).
  *Affects: 02 §2, 06, 07 §1, rule 8.*

- **2026-07-22 — search uses GENERATED `tsvector` columns, not a trigger.** 03 §1 says "tsvector
  column, updated by trigger"; a `GENERATED ALWAYS AS (...) STORED` column is the stronger form —
  Postgres recomputes it from the row on every write so it can never drift, needs no trigger to
  remember, and back-fills existing rows on ALTER without an UPDATE (so it does not disturb
  `lock_version`). Per-table expressions (only referencing columns that table has — documents and
  inspections have no `description`), weighted code A / title B / description C. Migration 0008 on
  inspections/ncrs/capas/documents + a GIN index each. One consequence rippled: the generic RLS
  write-isolation test clones a row by enumerating catalog columns, which then tried to write the
  generated column and threw a non-RLS error — fixed by excluding `is_generated <> 'NEVER'` columns
  from the clone (the tenant_id override + WITH CHECK assertion are unchanged, so the isolation
  mutation property still holds). *Affects: 03 §1, 08 §1.1.*

- **2026-07-22 — federated search is one endpoint, plant-scoped, RLS-confined.** `GET /v1/search`
  fans across the four searchable record kinds (a fixed table map, never user input, so the
  interpolated table name is safe), returns the top 6 per kind ranked by `ts_rank`, and reuses the
  list endpoints' plant-scope convention (inspections/NCRs filtered to `plant_ids` for scoped roles;
  CAPAs/documents are not plant-scoped). It carries no capability — every role holds the four
  `*:view` — and runs inside the request's tenant transaction, so RLS alone stops it being a
  cross-tenant existence oracle (rule 8). `websearch_to_tsquery` parses user input without throwing
  on stray punctuation. *Affects: 03 §1, 04, rule 8.*

- **2026-07-22 — file routes carry NO capability; the controls are tenant RLS + the scan gate.** The
  03 §3 matrix defines no file capability, so presign/complete/get/download require only an
  authenticated session (any tenant member can attach a file — an inspector uploading an evidence
  photo, an admin a document). Access is governed instead by (a) tenant RLS on the `files` table and
  (b) the AV-scan download gate. Deliberately did NOT invent a `file:*` capability — there is no
  matrix row to anchor it, and the real risk (serving unscanned/infected bytes) is the download gate's
  job, not a role check. *Affects: 03 §3, 03 §7.*

- **2026-07-22 — storage is a port; the download gate + size re-check are the security surface.**
  `Storage` (presignPut/presignGet/stat) is injected, with a real `S3Storage` (MinIO/S3, proven with
  a live round-trip) and a `FakeStorage` bound in tests, so the presign→complete→download logic is
  fully tested without a bucket (CI has no MinIO). Two server-side checks matter: `complete` stats the
  real object and rejects it if it exceeds the cap (a client that under-declared size to pass presign
  is caught), and `download` refuses any file whose `scan_status` is not `clean` — except the uploader
  while `pending` — and refuses `infected` to everyone. `sha256` is recorded from the S3 ETag (a
  re-hash for multipart uploads is a TODO). *Affects: 03 §7, 07 §3.*

- **2026-07-22 — a completed file stays `pending`, not auto-`clean`.** `complete` records the hash and
  hands off to the AV scan, which is a BullMQ job (06, Phase 2) that does not exist yet — so files sit
  at `pending` and are downloadable only by their uploader until the scanner flips them. This is the
  fail-safe posture (unscanned ≠ trusted); tests simulate the scanner's verdict by setting
  `scan_status` directly. *Affects: 03 §7, 06.*

- **2026-07-22 — added a `document:manage` capability; authoring is split from approval.** The 03 §3
  matrix names only "Approve documents" (admin/manager) and universal "View", leaving no capability
  for *authoring* a controlled document. Rather than gate create/submit/revise/archive/new-version on
  `document:approve` (which would misname the check and prevent a future author-but-not-approver
  role), added `document:manage` (admin/manager) for the author-side lifecycle and kept
  `document:approve` for the `/review` route. The split is what lets four-eyes land on a different
  person than the author. `document:view` (all roles) covers list/get/version-history; documents are
  not plant-scoped (no plant_id). rbac "every cell" grid updated on both sides. *Affects: 03 §3.*

- **2026-07-22 — a new document version can only be opened from `approved`, and it resets the record
  to draft.** `POST /v1/documents/:id/versions` is not a state-machine edge — it is the "new version
  resets to draft" rule (02 §4). It requires the current status to be `approved` (else 409
  INVALID_TRANSITION), inserts a fresh `document_versions` row at the new label, and moves the
  `documents` row to draft at that label with `approver_id` cleared — the previously approved
  version keeps its own row and approval stamp, so it stays approved and auditable. The
  keep-one-approved-version guard counts *other* approved `document_versions` rows, so archiving is
  blocked until a superseding version has been approved. *Affects: 02 §4, 03 §10.*

- **2026-07-22 — CAPA advance and revert are SEPARATE endpoints, not one transition route with a
  direction flag.** 02 §4 says phases advance only forward *except* an explicit, reasoned, audited
  revert. Modelling both on one control (or letting `advance` accept an earlier target) would make
  the exception reachable by the everyday action — exactly what the rule forbids. So forward motion
  is `POST /v1/capas/:id/advance` (one step, `capaMachine`) and backward is
  `POST /v1/capas/:id/revert` (earlier phase only, reason mandatory in both `canRevertCapa` and the
  `RevertCapaBody` schema, always writes a `status_changed` audit event with the reason). Both need
  `capa:manage`. *Affects: 02 §4, 03 §3.*

- **2026-07-22 — added a `capa:view` capability; CAPAs are not plant-scoped.** The 03 §3 matrix
  grants "View all modules" to every role but the initial capability list only had `capa:manage`
  (admin/manager), which would have hidden CAPAs from everyone else. Added `capa:view` (held by all
  five roles, mirroring `ncr:view`/`document:view`) so list/get honour the matrix while mutation
  stays `capa:manage`. Unlike NCRs, the `capas` table has no `plant_id`, so there is no plant-scope
  404 to fold in — every member with `capa:view` sees every CAPA. The rbac "every cell" grid was
  updated on both sides (impl + independent transcription). *Affects: 03 §3, rule 8.*

- **2026-07-22 — a CAPA's due dates are explicit inputs, not SLA-computed.** Unlike an NCR (whose
  `due_at` is computed from the tenant's SLA ladder + plant business hours on creation), a CAPA
  takes `dueAt` and `effectivenessCheckAt` as optional body fields. There is no `sla_configs` row
  for `entity_kind='capa'` and the spec does not define a CAPA SLA ladder; a programme's dates are
  set by its owner. Revisit if a CAPA SLA ladder is specified. *Affects: 02 §4.*

- **2026-07-22 — the generic request helpers (`AuditContext`, `membershipOf`/`actorIdOf`/
  `auditCtxOf`) still live under `apps/api/src/ncr/`, and the CAPA controller imports them from
  there.** They are not NCR-specific; they belong in a shared `http/` home. Left in place to keep
  this slice focused — a follow-up should move `ncr/audit-context.ts` + `ncr/handler-ctx.ts` to
  `http/` and repoint the ~5 importers. Tracked in Known issues. *Affects: 03 §1.*

- **2026-07-22 — NCR `verify` is a separate route from `transition`, split on capability.** The 03
  §3 matrix gives auditors `ncr:verify` but NOT `ncr:manage`, and managers-without-manage do not
  exist but the split still matters: a single `/transition` endpoint could only carry one
  `@RequireCapability`. So the manager-side moves (assign/start/resolve/close/escalate/reopen) live
  on `POST /v1/ncrs/:id/transition` (`ncr:manage`) and verification on `POST /v1/ncrs/:id/verify`
  (`ncr:verify`), which is exactly the set of roles allowed to be the second pair of eyes.
  *Affects: 03 §3, 02 §4.*

- **2026-07-22 — four-eyes is defended in BOTH the machine and the DB, and the mutation test proved
  why.** Feeding `resolvedBy: null` into the verify check (hiding who resolved it) let the app guard
  pass — but the write then hit `ncrs_four_eyes_ck` and failed with a 500 instead of the friendly
  409. So the security property held via the DB backstop even with the app guard defeated; the test
  caught the regression by status code. The app guard exists for the good error message; the CHECK
  exists so no path (job, sync replay, support tool) can bypass the rule. *Affects: 02 §4, 08 §1.*

- **2026-07-22 — NCR SLA due date is computed on creation, in the plant's timezone.** `computeDueAt`
  walks the tenant's `sla_configs` (per priority) and the plant's business hours; a manual NCR with
  no plant falls back to UTC. If no SLA row exists for the priority, `due_at` is left null rather
  than guessed. The sliding SLA state (`on_track`/`at_risk`/`breached`) recomputation over time is a
  job (Phase 2); creation sets `on_track`. *Affects: 03 §10, 08 §1.2.*

- **2026-07-22 — the NCR test suite seeds its own `sla_configs`.** The db-package suite truncates
  every tenant table (incl. `sla_configs`) earlier in the same serial `pnpm test` run, so relying on
  the provisioned rows made the NCR SLA assertion order-dependent (green alone, red in the full run).
  Seeding in the suite's own `beforeAll` — after that truncation — is the fix, consistent with "each
  suite seeds its own fixtures". A per-package database is still the real answer (Known issues).
  *Affects: 08 §1.*

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

- **SPC / FMEA has no backend spec — needs one before it can be built.** It is listed in FEATURES.md
  (SPC charts, FMEA workbench, risk register, MSA/Gauge R&R) and has a visual prototype
  (`project_brain/project/src/qms-risk-spc.jsx`), but `implementation/02-DATABASE`, `03-API` and
  `08-TESTING` define no tables, endpoints, or algorithms. Building it means specifying: SPC data
  capture + control-limit / Western-Electric / Nelson rule evaluation and Cp/Cpk; the FMEA workbench
  (failure modes, S/O/D → RPN, action tracking); the ISO-31000 risk register (5×5 residual scoring);
  and MSA/Gauge R&R studies. Requested during the scheduling slice but deferred here as a spec
  question rather than an invented module. *FEATURES §12; needs an `implementation/` addendum.*
- **Recurrence occurrences are computed on UTC calendar dates**, not the plant's timezone. Whole-day
  occurrences make this harmless for now (a "date" is a date), but a plant far from UTC could see an
  occurrence land a day early/late relative to local intent. Localising the expansion window to the
  plant tz is a follow-up. *02 §2.*
- **Exports are CSV only; XLSX and PDF are not yet rendered.** The async pipeline (202 → `reports`
  render → presigned download) and the 100k-row cap → zip are format-agnostic and done, but only the
  CSV renderer is built. `ExportFormat` is `['csv']`; XLSX (a sheet writer) and PDF (headless
  Chromium against print routes, 06 `reports`) slot in as additional renderers + enum values behind
  the same `run-export` processor. Also, export filters are minimal (an optional `status`) — richer
  per-resource filters would mirror each list endpoint's query. *06 `reports`, 03 §8.*
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
- **AV scanning now runs, but on a STUB scanner.** `FilesService.complete` enqueues a `scanFile` job
  and the worker flips `scan_status` — but the `Scanner` port is a filename-marker stub, not ClamAV,
  so it never actually inspects bytes. Consequently server-side magic-byte mime sniffing and SVG
  sanitisation (07 §3) are still not done (they belong in the real scanner that reads the object);
  presign only checks the client-declared mime string. The nightly orphaned-`pending`-row cleanup
  (03 §7) and (tenant, sha256) dedup are not built. Likewise notification email/push/SMS delivery
  runs through a stub `DeliveryChannels` port — no real provider yet.
- **Jobs are enqueued INSIDE the request transaction, before commit (no transactional outbox).**
  `FilesService.complete` / `NotificationsService.notify` call the producer within the request's tx,
  so a request that rolls back after the enqueue leaves an orphaned job (the scan job is idempotent
  and no-ops on a missing/again-pending row, so the blast radius is small). 06 §2 prescribes a
  transactional `outbox_events` table drained by a worker; adopt it when realtime lands, and route
  job enqueues through it too.
- **The SLA sweep's `sla_state` recompute bumps `lock_version`.** The system UPDATE trips the
  `bump_lock_version` trigger, so a user who loaded an NCR exactly as the 5-min sweep reclassifies it
  can get a spurious `STALE_WRITE` on their next write. Rare (only the one NCR being edited at that
  instant) and self-correcting on refetch; the real fix is excluding derived columns from the
  concurrency token. The sweep also selects active tenants by `control.tenants.status = 'active'` —
  revisit if provisioning uses other live statuses.
- **The worker is not in CI and has no deploy target.** `pnpm test` covers the processors + a BullMQ
  round-trip, but nothing boots the long-running `worker.ts` in CI, and there is no process manager /
  deploy stage for it yet. Its producer/queue connections are also not closed on API shutdown (only
  the `NoopProducer` runs in tests, so nothing leaks there; a dev/prod API relies on process exit).
- **MinIO bucket creation is manual/ad hoc.** `S3Storage` assumes the bucket exists; the local one
  (`kaenal-local`) was created by a one-off smoke script, not by provisioning. `provision-tenant`
  (or a bootstrap step) should ensure the bucket per region (07 §4 data residency) before production.
- **`files.sizeBytes` is exposed as a JS number.** The column is `bigint`; sizes are capped at 25 MB
  so they fit safely, but if the cap ever rises past 2^53 the DTO mapping (`Number(size_bytes)`) needs
  revisiting.
- **Generic request helpers are housed under `apps/api/src/ncr/`.** `ncr/audit-context.ts`
  (`AuditContext`) and `ncr/handler-ctx.ts` (`membershipOf`/`actorIdOf`/`auditCtxOf`) are
  feature-agnostic but the CAPA controller now imports them across the `capa/ → ncr/` boundary,
  which reads oddly. Move both to `apps/api/src/http/` and repoint the importers (ncr + capa
  controllers/services) in a small follow-up; no behaviour change.
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

- **Document code prefix — `DOC-` vs `D-`.** `reference/FEATURES.md` lists the document ID
  convention as `D-`; the committed `packages/core/src/codes.ts` (with 25 passing tests) uses
  `DOC-YYYY-NNNN`, consistent with the other three-letter prefixes (NCR, INS, CAPA, AUD, SUP). Kept
  `DOC-` — it is the built, tested artifact and `implementation/`-adjacent code wins over the
  reference inventory. Flag if the product wants literal `D-`. *Affects: codes.ts, FEATURES.md.*


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
