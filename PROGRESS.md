# Kaenal Build Progress

> Read this file FIRST in every session. Resume from "Current status" — never re-plan from scratch.
> Update it in the SAME commit as the work it describes.

## Current status

**Phase 0 done; Phase 1 backend COMPLETE; Phase 2 nearly done; FRONTEND STARTED — `apps/web` foundation
is up (Next.js App Router + Tailwind v4 on the ported design tokens, shell, sign-in, dashboard).** Data
plane, business logic, audit plumbing, the request lifecycle, authentication, the contract layer, all
five Phase-1 vertical slices (Inspections, Findings → NCR, CAPA, Documents, Files), federated Search,
Notifications, the typed `@kaenal/api-client`, the BullMQ jobs runtime (SLA escalation, AV scan,
notification delivery, async exports, recurring-inspection scheduling, document-expiry reminders,
soft-delete purge, the AI gateway), the
8D workflow, the Audits
module, async Reports/exports, scheduling/recurrence, document-expiry reminders, the
housekeeping purge, the governed AI gateway (doc-summary feature), audit-events partitioning +
the nightly partition-roll/tamper-check AND tenant offboarding (export bundle + gated purge) are
done and proven, and CI runs them on
every push/PR. 971 tests pass (259 db integration, 484 core unit, 189 api integration, 25 types unit,
11 api-client unit, 3 web unit); all six workspaces typecheck under strict TS and lint clean, and the web app
builds (`next build`, 17 routes). The RLS schema lint covers 36 tenant
tables. The isolation nets, DST math, recurrence expansion, dependency direction, request lifecycle, composite member FKs,
lockout durability, CSRF, plant-scope 404 (rule 8, one level down), NCR four-eyes, CAPA
forward-only/revert directionality and the document rules (approver-role, self-approval four-eyes,
last-approved-version protection) were all mutation-tested (the CAPA and document rules via the full
(from, to) matrix in core) — proven to fail when the guard is disabled. The rate limiter and the
file AV-scan download gate have behavioural tests (allow/deny paths), not a formal mutation.

**Tenant offboarding (01 §3.4, 06 §1 `housekeeping` → `offboardTenant`, 07 §5):** the staged, gated
teardown of a tenant. `pnpm offboard-tenant --slug X` (CLI mirroring `provision-tenant`) flips the
registry to `offboarding`, which blocks logins for free — `TenantRegistry.resolveBySlug` already
resolves only `active` tenants (≤60s cache lag) — and starts a 30-day grace clock (`offboarding_at`).
The nightly GLOBAL `offboardTenant` job (enqueued once per housekeeping sweep, like the partition roll)
then, for each tenant past its grace: (1) skips it if ANY legal hold is active (07 §5 — the hold blocks
the whole purge); (2) produces the mandated **export bundle** first — one JSON document per tenant
table (incl. the audit trail), zipped via `fflate` and uploaded through the `Storage` port, its key
recorded on `control.tenants.offboarding_export_key` so a resumed run never re-exports; (3) **purges**
every tenant table run as the tenant's own RLS scope (so a `DELETE` can only ever reach that tenant's
rows), FK-safe via a savepoint-per-table multi-pass (02 §7 RESTRICT), batched 10k — deliberately
RETAINING `audit_events` (append-only by construction; the app role cannot delete it, and erasing the
immutable trail is its own careful step, see Known issues; the bundle already captured it); (4) marks
the tenant terminal `offboarded` (`offboarded_at`). Idempotent + resumable: a crash mid-purge leaves
the tenant `offboarding` with its export key set, and the next run skips the export and re-runs the
idempotent deletes. Migration 0016 adds the lifecycle columns + the `offboarded` status
(`TenantStatus` enum). Grace math is pure + unit-tested in `packages/core/offboarding.ts`
(`isOffboardPurgeEligible`, 30-day boundary — 6 tests); 1 api test drives all three paths in one run
(export+purge, hold-blocked, grace-skipped). This completes the `housekeeping` queue's three jobs.

**Audit-events partitioning + partition roll (07 §1, 06 §1 `housekeeping`):** `audit_events` is now
declaratively range-partitioned by UTC month, unlocking the nightly tamper check the spec requires
("per-partition row count only ever grows; a shrink = tampering"). Migration 0015 recreates the table
as a partitioned parent — the partition key `created_at` must be in every unique key, so the PK is now
composite `(id, created_at)` (nothing FKs to audit_events, so widening it is safe) — with a default
partition (an audit write must never fail for want of a partition) plus explicit monthly partitions.
Ordering is load-bearing: existing rows are copied BEFORE `apply_tenant_rls`, because FORCE RLS binds
even the table owner. Append-only immutability is re-applied on the parent (REVOKE UPDATE/DELETE +
`reject_mutation` trigger — a BEFORE ROW trigger on a partitioned parent cascades to every partition,
present and future), and the two RLS enumerations (`check-rls.ts` lint + `rls.test.ts` suite) now match
`relkind IN ('r','p') AND NOT relispartition` so the partitioned PARENT is verified and the monthly
CHILDREN (which carry no RLS of their own — the parent's policy governs the app path) are skipped;
mutation-checked that breaking FORCE RLS on the parent still fails the lint. The roll job is GLOBAL
(partitions span all tenants), so the housekeeping sweep enqueues it once, not per tenant; it runs on
the owner connection (DDL + counting children directly, which the app can't reach). `packages/core/
audit-partitions.ts` holds the pure calendar/shrink logic (`upcomingPartitionMonths`,
`auditPartitionName/Range`, `isTampered`, `highWater` — 7 unit tests); the processor
(`processors/audit-partition-roll.ts`) provisions the current + next month ahead (keeping the default
empty) and records each partition's high-water count in a control-plane ledger
(`control.audit_partition_stats`), flagging + loudly logging any shrink and never lowering the stored
mark so the signal persists. 7 core + 2 api tests (provision + idempotent re-run; baseline count then
shrink detection). The `housekeeping` queue now carries two jobs (purge + partition roll).

**AI gateway slice (06 §3, FEATURES §16.1):** the single chokepoint every model call passes through —
`AiGatewayService` (`apps/api/src/ai/gateway.service.ts`) wrapping a pluggable `AiProvider` port
(`StubAiProvider` ships; NO other module imports a model SDK, the whole point of the chokepoint). The
model-free governance decisions are pure + unit-tested in `packages/core/ai-gateway.ts`
(`gateInvocation` fails closed in order — intelligence entitlement → `allow_ai` kill switch → residency
lock → budget; `redactPii`/`rehydrate` reversible PII masking; `routeFeature` per-feature model; budget
math — 13 unit tests). Per call the gateway: gates (a refusal records a `blocked` invocation and never
reaches a model), redacts PII pre-flight, assembles a versioned feature prompt (`ai/prompts.ts`, each
treating tenant text as untrusted DATA — prompt-injection defence, 06 §4), calls the provider OUTSIDE
any DB transaction (a short read tx gates, the model runs with no connection held, a short write tx
records), rehydrates redacted tokens in the output, and returns an `AiDraft {value, confidence,
sources}` — AI never writes an entity directly. Migration 0014 adds `ai_settings` (data controls),
`ai_budgets` (per-period token budget, charged on success; absent row = unmetered), and
`ai_invocations` (the AI audit trail + cost ledger — telemetry, so written directly, not via
`withAudit`, exactly like notifications). The `ai` queue's `generateSummary` job
(`processors/generate-summary.ts`) drafts a `doc_summary` and persists it to the document's dedicated
`ai_summary` sidecar as a `system` `updated` audit event (idempotent — an unchanged summary writes
nothing). 13 core + 7 api tests (all three block reasons, success with budget charge + PII round-trip,
graceful provider-failure, processor write + idempotent re-run + missing-doc skip). `seed:demo`
activates the pack and drafts the demo document's summary inline. The `ai` queue is the eighth in the
runtime.

**AI HTTP surface slice (06 §3):** the gateway is now reachable over HTTP. `POST /v1/ai/drafts`
(`AiService.draft`, `apps/api/src/ai/*`) runs the governed gateway for ANY feature and returns an
`AiDraftDto {invocationId, value, confidence, sources}`, or maps a refusal to the right status —
entitlement/budget → **402 `ENTITLEMENT_REQUIRED`** ("AI credits exhausted"), `allow_ai`/region → 403,
a provider failure → **503 `AI_UNAVAILABLE`** (06 §4 — never blocks the manual workflow). It writes no
entity: AI only returns a draft. `POST /v1/ai/summaries/accept` is the acceptance half (06 §3.6): a
normal, audited mutation writing the user-reviewed summary onto a document's AI-owned `ai_summary` with
an **`ai_draft_accepted`** event (actorKind user) under optimistic concurrency — and it verifies the
`invocationId` traces to a real succeeded call in-tenant, so a fabricated draft id can't be accepted.
The gateway manages its own short transactions (a model call must not pin the request connection), so
`draft` takes no request tx; `accept` runs in it. Two new `ErrorCode`s (402/503) + DTOs + contract
entries; the gateway is DI-provided (`AI_GATEWAY`/`AI_SERVICE`, stub provider). 7 api tests (draft
success + all three refusal statuses + bad-feature 422; accept writes summary + event + optimistic-
concurrency 409 + unknown-invocation 404). Deferred (FE-coupled): SSE streaming, acceptance on business
fields (root-cause/8D), the `compliance_qa` pgvector retrieval, and a real model provider.

**Orphaned-upload cleanup slice (06 `files`, 03 §7):** the second `files`-queue job. A presign creates
a `pending` row + a short-TTL PUT URL; if the client never calls `complete`, that row (and, if it
uploaded but didn't complete, its object) lingers. A nightly `filesSweep` fans out
`cleanupOrphanedUploadsForTenant` per active tenant, which GC's never-completed uploads — `pending`
rows with `sha256 IS NULL` older than the 24h grace (03 §7). A completed-but-unscanned file keeps its
`sha256`, so it is never mistaken for an orphan. Safety mirrors the purge: candidates are locked
`FOR UPDATE` (a `complete` racing the grace boundary blocks, then fails cleanly on the vanished row);
each deletion writes a `purged` audit event (system actor, closing the `created` event `presign`
opened); and the object is deleted via `Storage.delete` only AFTER the DB commit, best-effort. 2 api
tests (stale orphan collected + object gone + kept recent/completed; idempotent re-run). This retires
the last files-queue TODO.

**Housekeeping / soft-delete purge slice (06 `housekeeping`, 07 §5):** the nightly `housekeeping`
BullMQ queue (`purgeSoftDeletedForTenant`, fanned out one job per active tenant) permanently deletes
rows soft-deleted longer ago than the 90-day retention window — the irreversible half of the delete
that `deleted_at` only defers. Two invariants keep it safe. **Legal holds win:** the processor reads
active `legal_holds` (07 §5) and, per the pure `packages/core/purge.ts` scope logic, a tenant-wide
hold (`scope {}`) aborts the whole run while a scoped hold (`{entityKind[, entityId]}` or
`{entityKinds:[…]}`) protects the rows it covers — any ambiguity keeps the data. **FK integrity is
never violated:** every intra-tenant FK is `ON DELETE RESTRICT` (02 §7), so each row is deleted inside
its own `SAVEPOINT`; a still-referenced parent (live or not-yet-purged child) skips on the FK
violation (`23503`) and purges on a later run, children-before-parents ordering draining a graph in as
few nights as possible. Each purge writes a distinct `purged` audit event (system actor; new
`AuditAction` value + migration 0013 CHECK — `deleted` stays the soft delete, `purged` the erase). The
purge covers the inspection/NCR/CAPA/audit/supplier record graphs + their soft-deletable children +
templates/plants/areas + `documents` and `files`; it deliberately excludes access/identity tables
(`memberships`, `notification_prefs`, `sessions` — DSAR/offboarding lifecycle) and `exports` (generated
artifacts). **Documents/files (added later):** `document_versions` has no `deleted_at` of its own — it
is collateral of its `documents` parent, so it is cascade-deleted in the SAME `SAVEPOINT` when the
document purges (a small `DEPENDENT_CASCADES` map, each version also getting a `purged` event). `files`
purge last (referenced by inspections/documents/versions/signatures, so RESTRICT skips them until those
clear; a file still on a `signature` is retained evidence and never purges). A purged file's
object-store object is deleted through a new `Storage.delete(key)` — but only AFTER the DB transaction
commits, so a rolled-back purge never orphans a live row from its bytes, and a failed object delete is
logged and left for the storage-cleanup job, never fatal. 10 core unit tests (cutoff arithmetic + every
hold-scope shape) + 4 api tests (mixed purge/keep with hold + FK-RESTRICT skip, idempotent re-run,
tenant-wide-hold block, and the documents→versions cascade + file object delete + referenced-file
block). The `housekeeping` queue is the seventh in the jobs runtime.

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
is the data egress, audited `exported` like a file download. **Three renderers** now sit behind the
one pipeline, dispatched on `format` (all pure + unit-tested in `packages/core/exports.ts`): CSV
(RFC-4180, chunked-zip past the cap), XLSX (a minimal hand-rolled OOXML workbook — inline strings, no
deps beyond `fflate`), and a simple tabular PDF (hand-rolled, Courier/monospaced columns, paginated,
correct xref — validated independently). XLSX/PDF are single documents (they page internally), so only
CSV takes the chunk-to-zip path; migration 0017 widened the `format` CHECK. A richer branded PDF
(headless Chromium + print routes + PDF Template Designer, 06/09) supersedes the tabular one later.
`run-export` is
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
the API, with eight queues wired: `sla` (repeatable every-5-min sweep → fans out one `recomputeSla`
job per active tenant → reclassifies open NCRs against their SLA window with the core business-time
math, escalates breaches through `ncrMachine`, audits as a `system` actor, notifies the owner),
`files` (`scanFile` → a pluggable `Scanner` port flips `scan_status`, infected notifies the uploader;
plus a nightly `filesSweep` → fans out `cleanupOrphanedUploads` per tenant → garbage-collects
never-completed pending uploads > 24h + their objects, see the Orphaned-upload cleanup slice),
`notify` (`deliverNotification` → a `DeliveryChannels` port fans an in-app row to
email/push/SMS per the user's `notification_prefs`, recording `channels_sent`), and `reports`
(`runExport` → renders a requested export server-side and uploads it via the `Storage` port; see the
Reports/exports slice), `schedule` (repeatable hourly sweep → fans out one
`materializeSchedule` job per tenant → expands recurring inspection series into occurrences; see the
Scheduling slice), and `docs` (repeatable daily sweep → fans out one `documentExpiryCheck` job per
tenant → reminds owners of documents nearing expiry; see the Document-expiry slice), and
`housekeeping` (repeatable nightly sweep → fans out one `purgeSoftDeleted` job per tenant →
permanently deletes rows soft-deleted past the 90-day window, minus legal holds; PLUS two global jobs
per sweep — `auditPartitionRoll` → provisions upcoming audit partitions + tamper-checks counts, and
`offboardTenant` → exports + purges tenants past their offboarding grace; see the Housekeeping,
Audit-partitioning and Offboarding slices), and `ai` (on-demand `generateSummary` → drafts a document summary through the AI gateway
chokepoint; see the AI gateway slice). Scanner + delivery + the AI provider
are stub ports (no ClamAV/Resend/Anthropic yet); the plumbing, DB
effects and idempotency are real. The API only
ENQUEUES, behind a `JOBS_ENABLED` gate — off in `test` (a `NoopProducer`, no queue connection), so the
HTTP suites never touch BullMQ; `FilesService.complete` enqueues a scan, `NotificationsService.notify`
enqueues a delivery, and `ExportsService.create` enqueues a render (the `sla`/`schedule`/`docs`/
`housekeeping` sweeps are worker-internal repeatables, not API-enqueued; the `ai` queue has no HTTP
enqueuer yet — its processor + gateway are wired and tested, awaiting the trigger endpoint). Job rules
per 06: 5× exponential
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
not a silent build. All three 06 `housekeeping` jobs now ship (`purgeSoftDeleted` — including
documents/files with the `document_versions` cascade + S3 object delete, `auditEventPartitionRoll`,
`offboardTenant`), the `ai` gateway + its HTTP surface (`POST /v1/ai/drafts` + summary acceptance),
and all three export renderers (CSV/XLSX/PDF). **The specified backend is now essentially complete.**
What remains is largely FE-coupled or needs new infrastructure: SSE streaming for AI, acceptance on
business fields (root-cause/8D) + the `compliance_qa` pgvector retrieval, the richer branded PDF
(Chromium + print routes, 09), a real Anthropic-backed `AiProvider` (replacing the stub), and real
ClamAV + email/push providers (replacing the stub scanner/delivery ports). SPC/FMEA still needs a spec.
Suppliers/PPAP/SCAR is Phase 4. The **FE** (`apps/web`) is now under way against `@kaenal/api-client` —
foundation shipped (shell, tokens, design system, sign-in, dashboard); module screens next.

### How to get running from a cold clone

```bash
corepack enable && pnpm install
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
docker compose up -d          # postgres:16 (5433), redis:7 (6380), minio (9000/9001)
pnpm db:migrate               # apply migrations/*.sql in order (through 0017)
pnpm db:check                 # RLS schema lint — must pass
pnpm provision-tenant --slug acme --name "Acme Manufacturing" --model shared
pnpm provision-tenant --slug globex --name "Globex" --model shared   # api tests need both
pnpm test                     # full suite (serial: shares one DB) — 971 tests
```

**To run the web app:**

```bash
pnpm --filter @kaenal/api dev          # API on :3001
pnpm --filter @kaenal/web dev          # web on :3000 → http://localhost:3000
```

The browser talks to the API through a same-origin proxy (`/api/*` → the API, `next.config.mjs`), so
the session cookie + CSRF stay same-origin (no CORS). Sign in with a provisioned workspace slug, a
member email, and password. Engineering docs live in `apps/web/README.md` + `apps/web/docs/`.

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

Frontend — STARTED 2026-07-24. `apps/web` (Next.js 15 App Router, React 19, TS strict, Tailwind v4)
consumes the ts-rest contract via `@kaenal/api-client`. The foundation slice is up and building; the
per-module screens come next. Engineering docs: `apps/web/README.md`, `apps/web/docs/{rules,best-practices}.md`.

- [~] Next.js app shell — sidebar (collapse + mobile drawer, capability-gated nav, **expandable sub-navs**
      matching shell.jsx with accent left-border on the active item) + topbar (breadcrumbs, theme toggle,
      profile/sign-out) DONE; command palette (⌘K) pending (04 §3). Sub-navs are only listed when their
      target route exists (a dead nav link is worse than none): Inspections → All/Templates/Schedule, NCRs →
      All/My Assignments (`?view=mine`)/Overdue (`?view=overdue`). Inspections → **Schedule is a real
      calendar** (`schedule-view.tsx`, matching schedule.jsx): month grid (default, today highlighted,
      color-coded event pills), week grid (7 day-columns, timed events), and list/agenda — with
      prev/today/next navigation and a status legend (scheduled=blue / completed=green / overdue=red).
      Inspections-only (audits module renders here in the prototype but shares no data source yet); the
      fabricated iCal-sync feed is omitted. Templates page previews the form schema read-only. Deferred:
      drag-drop template editor (create/edit → publish immutable version).
- [x] Design tokens ported → `apps/web/src/styles/{tokens.css,globals.css}`; Tailwind v4 `@theme inline`
      bridges them so utilities + `.k-*` classes are theme-aware; light/dark via `data-theme` (04 §2)
- [x] Unified design-system primitives in `src/components/ui` (Button, Card, Chip, Status/Priority/Risk
      badges, Input, Field, Skeleton, Spinner, EmptyState, Toast), one barrel; `cn` (clsx+tailwind-merge)
- [x] Auth surface: sign-in (workspace→credential two-stage, matches auth.jsx) + forgot-password +
      **reset-password** (`/reset-password`, real `checkPasswordPolicy`) + **accept-invite**
      (`/invite/[token]`) wired to the cookie/CSRF auth surface; session guard + sign-out. Account-locked
      screen deliberately omitted (the API returns the wrong-password envelope for a lock — 07 §2 anti-
      enumeration — so a real locked-detection UI would leak account state); request-workspace omitted (no
      self-serve provisioning endpoint). Prototype fixture data (mock tenants/SSO/inviter) not fabricated.
- [~] Dashboard → Inspections → NCR → CAPA → Documents — Dashboard foundation + **NCRs + Inspections DONE**;
      CAPA/Documents are placeholders. **Inspections** (`feat/web-inspections`): list/grid with status filter +
      search + CSV export; create dialog (schedule from a published template); detail with the **dynamic form
      renderer** (one control per FormItemType, `isVisible` conditional gating) + **live scoring** (the shared
      `scoreInspection` from `@kaenal/core`, recomputed as you fill); start → fill → complete flow with
      client-side `validateResponses` gating before submit and the server-authoritative score on completion;
      Findings tab (record finding + raise-NCR via `findingId`, wiring Inspection→NCR). Verified end-to-end vs.
      the seeded API (filled the Line Safety Walk template, live score 95→server 100 on complete). **NCRs** (`feat/web-ncrs`): list (table + kanban) with search/status/priority filters,
      create dialog (RHF+Zod), detail (contextual transitions, four-eyes verify, Details/Actions/History
      tabs, meta sidebar), Actions CRUD (containment/corrective/preventive add + toggle). Kanban drag →
      transition with optimistic move + 409/illegal-move revert + toast. Verified end-to-end vs. the real
      API (transition Assigned→In Progress, action-add). Shared primitives added: `PageHeader`, Radix
      `Dialog`, `Segmented`, `api-error` helpers, `format` utils.
- [~] All six UI states on every list/detail (04 §6) — loading/empty/error demonstrated on the dashboard;
      stale-write (409), offline, and per-capability hiding land with the first CRUD module

## Phase 2 — Depth
- [x] 8D workflow (step gating: N requires 1..N-1, D3 may parallel D2) (2026-07-22) —
      `packages/core/eight-d.ts` + `apps/api/src/eight-d/*`; gating, 8D↔NCR close-block, migration 0009
- [x] Audits + audit findings (2026-07-22) — `packages/core/state-machines/audit.ts` +
      `apps/api/src/audits/*`; phase machine, findings, raise-NCR/raise-CAPA seam, migration 0010
- [~] BullMQ jobs runtime (2026-07-22) — worker process + `sla` (escalation), `files` (AV scan),
      `notify` (delivery), `reports` (async export render), `schedule` (recurrence materialisation),
      `docs` (document-expiry reminders), `housekeeping` (soft-delete purge) queues DONE
      (`apps/api/src/jobs/*`), `ai` queue (doc-summary via the gateway chokepoint),
      `housekeeping`'s `auditEventPartitionRoll` (partition provisioning + tamper check) and
      `offboardTenant` (export bundle + gated purge) DONE — all six queues + all three housekeeping
      jobs shipped
- [x] Reports / exports (2026-07-22) — `packages/core/exports.ts` + `apps/api/src/exports/*` +
      `apps/api/src/jobs/processors/run-export.ts`; 202 → `reports` render → presigned download,
      100k-row cap → chunked zip (`fflate`), plant-scoped + requester-scoped, migration 0011.
      CSV + XLSX (OOXML) + tabular PDF renderers, dispatched on `format`, migration 0017 (2026-07-23)
- [x] Scheduling & recurrence (2026-07-22) — `packages/core/recurrence.ts` (expand incl. Feb 29 /
      month-end) + `inspections` service/controller + `apps/api/src/jobs/processors/materialize-schedule.ts`;
      hourly `schedule` queue, idempotent on `(series_id, date)`, migration 0012
- [x] Document-expiry reminders (2026-07-22) — `packages/core/document-expiry.ts` (90/30/7 threshold
      cascade) + `apps/api/src/jobs/processors/document-expiry.ts`; daily `docs` queue, dedupe on
      `(document, threshold)`, no schema change
- [x] Housekeeping / soft-delete purge (2026-07-23) — `packages/core/purge.ts` (retention + legal-hold
      scope) + `apps/api/src/jobs/processors/purge-soft-deleted.ts`; nightly `housekeeping` queue,
      SAVEPOINT-per-row FK-RESTRICT skip, `purged` audit action (migration 0013); now includes
      documents/files (`document_versions` cascade + post-commit `Storage.delete` of the S3 object)
- [x] Orphaned-upload cleanup (2026-07-23) — `apps/api/src/jobs/processors/cleanup-orphaned-uploads.ts`;
      nightly `filesSweep` fan-out → GCs never-completed `pending` uploads > 24h (FOR UPDATE lock,
      `purged` audit, post-commit object delete) — retires the last `files`-queue TODO
- [x] Tenant offboarding (2026-07-23) — migration 0016 (lifecycle columns + `offboarded` status) +
      `offboard-tenant` CLI + `packages/core/offboarding.ts` (30-day grace) +
      `apps/api/src/jobs/processors/offboard-tenant.ts` (global `housekeeping` job: legal-hold gate →
      JSON-per-table export bundle → FK-safe batched purge, audit trail retained → `offboarded`)
- [x] Audit-events partitioning + roll (2026-07-23) — migration 0015 (monthly RANGE partitions,
      composite PK, default partition, re-applied RLS/append-only) + `packages/core/audit-partitions.ts`
      + `apps/api/src/jobs/processors/audit-partition-roll.ts` (global `housekeeping` job: provision
      ahead + per-partition shrink/tamper check via `control.audit_partition_stats`); RLS enumerations
      updated for partitioned parents/children (mutation-checked)
- [~] AI gateway chokepoint (2026-07-23) — `packages/core/ai-gateway.ts` (gate/redact/route/budget) +
      `apps/api/src/ai/*` (gateway service + provider port + prompts + HTTP controller/service) + `ai`
      queue's `generateSummary`; migration 0014 (`ai_settings`/`ai_budgets`/`ai_invocations`).
      `doc_summary`, `POST /v1/ai/drafts` (all features) + `POST /v1/ai/summaries/accept`
      (`ai_draft_accepted`) DONE; SSE + business-field acceptance + `compliance_qa` retrieval + real
      provider pending
- [x] AI HTTP surface (2026-07-23) — `apps/api/src/ai/{ai.controller,ai.service}.ts`; draft endpoint
      (gateway over HTTP, refusals → 402/403/503) + summary-acceptance (audited, optimistic concurrency);
      `ENTITLEMENT_REQUIRED`/`AI_UNAVAILABLE` error codes; DTOs + contract entries
- [ ] SPC / FMEA — deferred pending spec (see Known issues): no backend schema/API/algorithm in
      `implementation/`, only a FEATURES bullet + visual prototype

## Phase 3 — Mobile
- [ ] Expo field-inspector app
- [ ] Offline SQLite + sync queue with conflict resolution (05)

## Phase 4 — Platform
- [~] AI gateway + copilots (+ governance, region lock, budget gates) — gateway chokepoint +
      governance (entitlement/data-control/budget/region gate, PII redaction, invocation ledger) +
      `doc_summary` DONE (2026-07-23); copilots (root-cause/8D drafting), draft-acceptance flow,
      compliance-QA retrieval, and a real model provider pending
- [~] Model B (dedicated Postgres per tenant, 01 §3.1) — request + job routing, provisioning, fan-out,
      drop-DB offboarding, and audit-partition-roll fan-out all DONE (2026-07-24): secret resolver
      (`env:`/`localdb:`) + LRU `TenantPoolManager`; the interceptor routes requests and a
      `RegistryDbRouter` routes the worker's per-tenant jobs + the AI gateway to each tenant's pool (RLS
      still applies), fail-loud on unresolvable secret; `provision-tenant --model dedicated`
      creates+migrates+seeds the DB, `db:migrate:tenants` fans migrations out per-tenant under a lock;
      offboarding drops a dedicated tenant's whole database (after the same hold-gate + export), and the
      nightly partition roll fans out to each dedicated DB's own audit partitions. Remaining: only the
      cloud secret-manager resolver (`awssm:`/`gcpsm:`) for off-cluster dedicated DBs — see Known issues
- [ ] Supplier portal
- [ ] Public API + webhooks (HMAC signing, retry ladder)
- [ ] SSO/SCIM via WorkOS
- [ ] Add-on entitlements

---

## Decisions log

- **2026-07-24 — Web foundation: tokens as the one styling source, Tailwind v4 bridges to them, primitives
    hand-built, Radix reserved for the hard a11y widgets.** `apps/web` is Next.js 15 (App Router, React 19,
    TS strict). Styling is the token system, not per-component CSS: `src/styles/tokens.css` holds every
    value (a verbatim port of the updated visual spec — near-monochrome ink accent, Archivo, tight radii),
    and `globals.css` bridges it into Tailwind v4 via `@theme inline` so utilities AND the `.k-*` classes
    resolve to the same themed variables — a restyle is one file, light/dark is a `[data-theme]` remap.
    Chose to **hand-build the simple primitives** (Button/Card/Chip/Input/Table) on those token classes so
    they match the prototype 1:1, and to **reserve Radix** (the market-standard accessible headless layer,
    the way shadcn/ui uses it) for the interactive widgets that actually need it (command palette, menus,
    dialogs, tooltips) as those modules land — rather than pulling in all of shadcn and reskinning it now.
    Data flows ONLY through `@kaenal/api-client`'s query factories + `unwrap` (no `fetch` in components);
    auth (sign-in/sign-out — outside the ts-rest contract) is the one exception, in `lib/auth.ts`. The
    browser reaches the API via a same-origin Next rewrite proxy (`/api/*`), so the httpOnly session cookie
    + CSRF double-submit need no CORS. `allowUmdGlobalAccess` lets components use the `React.*` type
    namespace without a per-file import (automatic JSX runtime never imports React); `next.config` adds a
    webpack `extensionAlias` so the TS-ESM `.js` specifiers in the shared packages resolve without a build
    step. i18n (`next-intl`), real-time, the ⌘K palette, and Sentry are deliberately deferred (04, tracked
    in Known issues). *Affects: 04 §1–3, §6; TECH_STACK §2.1.*

  - **Design conflict logged (per CLAUDE.md "on conflict, log it"):** 04-WEB-APP.md §2 describes a
    blue-accent / Inter palette; the user's updated `styles/tokens.css` (the visual source of truth per
    CLAUDE.md) is a near-monochrome **ink** accent with **Archivo**. tokens.css WINS; §2's literal hex/font
    list is stale prose. The web app ports tokens.css, not §2.

- **2026-07-24 — Model B teardown + partition-roll fan-out: reuse the secret ref as the source of truth,
    fake only the irreversible drop in tests.** Offboarding a dedicated tenant drops its whole database
    instead of the shared-DB row-purge. Same gate + export as shared, but read from the tenant's OWN
    database (hold check + export bundle route `withTenant(..., dedicatedPool)`); the terminal step is
    `DROP DATABASE IF EXISTS "<db>" WITH (FORCE)` on a RAW owner connection — no `withoutTenant` wrapper,
    because `DROP DATABASE` is forbidden inside a transaction block. The db name comes straight from the
    `localdb:<db>` secret ref (new shared `localDbName()` helper), not re-derived from the slug, so
    teardown targets exactly the database provisioning created; `IF EXISTS` makes a crash between the drop
    and the status flip resumable. The audit-partition roll now takes an optional owner `pool` (threaded
    into every `withoutTenant`), and `fanOutAuditPartitionRoll` mirrors the migration fan-out — one owner
    pool per dedicated DB (migrator URL = base migrator URL with the db name swapped in), `offboarded`
    tenants skipped, per-tenant failures collected not thrown. Both paths are **localdb-only**: DDL/DROP
    need an owner connection whose URL is derived from the primary's, which only the same-cluster
    convention exposes — a cloud (`env:`) tenant is left `offboarding` / collected as a failure until an
    owner-secret scheme exists. Tests fake the DROP owner pool (recording the SQL, destroying nothing) and
    point the "dedicated" DB at the primary via `localdb:kaenal`, so real RLS reads run while nothing is
    actually dropped — and assert the dedicated path does NOT row-purge (rows survive the faked drop).
    This closes Model B for local/self-hosted; only the cloud secret-manager resolver remains.
    *Affects: 06 §1 `housekeeping`, 01 §3.1/§3.4, 07 §5.*

- **2026-07-24 — Model B job-path routing: one router at the worker + gateway, `pool?` threaded as a dep.**
  The request path resolves the tenant by slug and hands the pool to `withTenant`; jobs and the AI gateway
  only have a tenant id, so they route through a new `RegistryDbRouter` (tenantId → model/secret, briefly
  cached; delegates the pool to `TenantPoolManager`). Rather than teach every processor about the registry,
  the WORKER resolves the pool once per job and passes it as an optional `deps.pool`, which each processor
  forwards to `withTenant` — a uniform, mechanical change, and the processors stay ignorant of routing.
  The AI gateway opens its own short txs (outside any request tx), so it takes an optional `pool` on
  `AiRunParams`, threaded from the worker (generate-summary) and — on the request path — from the request
  context via a new `currentPool()` (the interceptor now stashes the resolved pool in context). Under
  `exactOptionalPropertyTypes`, an explicitly-passed `undefined` needs `pool?: pg.Pool | undefined` on the
  dep objects (a bare `pool?: pg.Pool` rejects it). `offboardTenants` now **skips** dedicated tenants:
  their teardown is a database drop, not the shared-DB row-purge, so running the purge with a dedicated id
  would be wrong — better to skip until drop-DB lands. Left for follow-up: the global `auditPartitionRoll`
  still rolls only the primary's partitions; dedicated DBs need the same roll fanned out. *Affects: 06 §1,
  §3, 01 §3.1.*

- **2026-07-24 — Model B provisioning/fan-out: slug is the single source of truth, `localdb:` keeps it
  self-consistent.** A dedicated tenant's whole world is derived from its slug: database name
  (`kaenal_ded_<slug>`, `-`→`_` so it's injective and identifier-safe), migrator URL and app URL (swap the
  db name in the primary's `DATABASE_URL`/`DATABASE_APP_URL`), and the registry secret ref
  (`localdb:<dbname>`). This means provisioning and fan-out never disagree about where a tenant lives, and
  the API resolves the same `localdb:` ref back to the same URL — no per-tenant env var to wire up locally.
  (`env:` stays for cloud, where dedicated DBs sit on other hosts.) The registry row is parked
  `provisioning_failed` and only flipped `active` once CREATE DATABASE + migrate + seed + smoke-test all
  pass, so `resolveBySlug` (active-only) can never route to a half-built database — better than the shared
  path's insert-active-then-park because there's no window where a broken dedicated tenant is live. The
  migration runner was extracted (`scripts/lib/migrate-runner.ts`) so the primary `migrate`, provisioning,
  and the fan-out apply migrations identically; fan-out isolates per-tenant failures (one bad DB doesn't
  block the rest) and takes a per-DB advisory lock so a concurrent run/provision can't double-migrate.
  Convention assumes dedicated DBs share the primary cluster; a separate-host deployment swaps the URL
  derivation for stored per-tenant URLs. *Affects: 01 §3.4, 02 §migrations.*

- **2026-07-24 — Model B routing is a connection-swap at one seam, not a code fork.** The two
  isolation models (01 §3.1) meet in exactly one place: which pool `withTenant` runs on. Shared tenants
  use `@kaenal/db`'s `appPool` (the default arg); dedicated tenants get a per-tenant pool from a new
  `TenantPoolManager` (LRU-capped, promise-memoised so concurrent first-hits share one pool), resolved
  from the registry's `database_url_secret_ref` via a `SecretResolver` (`env:VAR` locally; a cloud
  secrets-manager impl drops in behind the interface). Because every service already reads its `tx` from
  the request context, NOTHING downstream changed — the interceptor picks the pool and passes it to
  `withTenant`, and RLS still runs on the dedicated DB (defence in depth). The secret ref is a *pointer*,
  never the credential, so a control-plane leak never leaks connection strings (07 §4). Chose to **fail
  loud** (500) when a dedicated tenant's secret is unresolvable rather than fall through to the shared
  pool — a silent fall-through would put one tenant's data in another's database, the worst possible bug
  here; a test asserts the 500. Deliberately scoped this slice to the **request path** (01 §3.3 step 3,
  the security-critical one); provisioning, migration fan-out, **job-path routing** (a real correctness
  gap once dedicated tenants exist — worker still uses the shared pool), and drop-DB offboarding are
  tracked in Known issues. *Affects: 01 §3.1, §3.3.*

- **2026-07-23 — AI HTTP surface: draft endpoint is the gateway over HTTP (self-managed txs),
  acceptance is a normal audited mutation, refusals map to 402/503, types emit no `.d.ts`.** `POST
  /v1/ai/drafts` calls `AiGatewayService.run` directly and does NOT use the request's `currentTx()` —
  the gateway opens its own short transactions around the (out-of-tx) provider call, so a slow model
  can't pin the request connection. Governance refusals surface as HTTP: entitlement/budget → **402
  `ENTITLEMENT_REQUIRED`** (the spec's "AI credits exhausted"), `allow_ai`/region → 403, provider
  failure → **503 `AI_UNAVAILABLE`** (06 §4, soft-fail). Acceptance (06 §3.6 "AI never writes, the user
  accepts") is `POST /v1/ai/summaries/accept` — a normal document mutation with an `ai_draft_accepted`
  event under optimistic concurrency, which also verifies the `invocationId` is a real succeeded call
  in-tenant so a fabricated draft can't be accepted. It lives in the `ai` module because `ai_summary`
  is an AI-owned sidecar; business-field acceptance (root-cause/8D) will go through those entities'
  own services. Adding the two routes pushed the ts-rest `contract` inferred type past TS's `.d.ts`
  serialization limit (TS7056); since the types package is consumed from source (`main` → `src`),
  `declaration:false` there resolves it with no loss of consumer type-safety. *Affects: 06 §3, 03 §4.*

- **2026-07-23 — XLSX/PDF export renderers are hand-rolled + dependency-light; the branded PDF is
  deferred.** Both new renderers live in `packages/core/exports.ts` beside `toCsv`, pure and
  unit-tested. **XLSX** is a minimal OOXML workbook (inline strings, no styles/sharedStrings) zipped
  with the `fflate` already in the repo — no `exceljs`-class dependency, matching the codebase's
  hand-rolled-CSV style. **PDF** is a minimal tabular document using the standard Courier font (metrics
  built into every reader, so no font embedding) with space-padded monospaced columns and pagination;
  the xref offsets are computed exactly (validated independently — every offset lands on its object).
  The spec's rich PDF path (headless Chromium against the web app's print routes + the PDF Template
  Designer, 06/09) was NOT built: it needs the Next.js print routes and a Chromium runtime, neither
  present in this backend repo, and a hand-rolled divergent-but-branded PDF would be invented scope —
  so the tabular PDF is the honest interim, logged in Known issues. Dispatch is on `exports.format`;
  XLSX/PDF are single documents (only CSV keeps the chunk-to-zip path). *Affects: 03 §8, 06 `reports`.*

- **2026-07-23 — orphaned-upload cleanup: `sha256 IS NULL` marks never-completed, FOR UPDATE guards
  the race, `purged` audit, object-after-commit.** An orphan is a `pending` `files` row with
  `sha256 IS NULL` older than 24h (03 §7): `presign` inserts pending, `complete` sets `sha256` (scan
  keeps `pending` until it runs), so a null `sha256` unambiguously means "never completed" — a
  completed-but-unscanned file is never collected. Candidates are locked `FOR UPDATE` so a `complete`
  racing the 24h boundary blocks and then fails on the vanished row rather than resurrecting it. Since
  `presign` writes a `created` event, the GC writes a `purged` event (system actor) to close the trail,
  not a silent delete. Object deletion happens AFTER the DB commit (same rule as the purge — never
  orphan a live row from its bytes on rollback). The job lives on the `files` queue (per the 06 table),
  fanned out per tenant by a nightly `filesSweep`. *Affects: 06 §1 `files`, 03 §7.*

- **2026-07-23 — documents/files added to the soft-delete purge: dependent cascade, files-last,
  object-delete-after-commit.** `document_versions` has no `deleted_at` (it can't drive its own
  purge), so it is treated as a **dependent cascade** of `documents`: a small `DEPENDENT_CASCADES` map
  deletes a document's versions in the SAME `SAVEPOINT` as the document (each version still getting a
  `purged` event), which also clears the versions' FK to `files`. `files` is ordered **last** in
  `PURGE_ORDER` because it is referenced by inspections/documents/versions/signatures — RESTRICT skips
  a file until those clear, and a file pinned by a `signature` (retained evidence) never purges, which
  is correct. A purged file's object is removed via a new `Storage.delete(key)` **after the DB
  transaction commits** — deleting bytes before commit could orphan a live row from its object on a
  rollback, whereas the reverse only risks a harmless storage orphan (logged, left for the unbuilt
  `cleanupOrphanedUploads`). This retired the earlier "excludes documents/files" carve-out. *Affects:
  06 §1 `housekeeping`, 03 §7.*

- **2026-07-23 — tenant offboarding: purge as the tenant's RLS scope, retain audit_events,
  export-before-delete, savepoint multi-pass, terminal status, global resumable job.** The purge runs
  through `withTenant(tenantId)` as the APP role, NOT as the owner: RLS then scopes every `DELETE` to
  the tenant automatically (a `WHERE tenant_id` that can't be forgotten), and the app already holds
  DELETE on every tenant table — except `audit_events`, which it deliberately cannot delete. So the
  purge **retains `audit_events`** (the append-only trail; the export bundle captured it, and its
  destruction — which would require disabling immutability under an exclusive lock, or a Model-B
  database drop — is a separate careful step, logged in Known issues). This also sidesteps FORCE RLS
  blocking an owner `DELETE` with `app.tenant_id` unset. The mandated **export bundle is produced
  before any delete** (07 §5) — one `json_agg` document per tenant table, zipped, uploaded via the
  Storage port, key recorded so a resumed run skips it. FK RESTRICT (02 §7) is handled by a
  **savepoint-per-table multi-pass** (same shape as the soft-delete purge) rather than a hand-kept
  delete order. Any **active legal hold blocks the whole purge** (07 §5). The tenant ends at a terminal
  **`offboarded`** status (registry row kept, slug reserved, Model A). The job is **global** (enqueued
  once per housekeeping sweep, not per tenant) and **idempotent/resumable** (crash mid-purge → stays
  `offboarding` with export key set → next run resumes). Login-blocking needed no new code: the
  registry already resolves only `active` tenants. *Affects: 01 §3.4, 06 §1 `housekeeping`, 07 §5.*

- **2026-07-23 — audit_events partitioning: composite PK, default-partition + provision-ahead,
  copy-before-RLS, enumeration filter, global roll job, high-water tamper ledger.** `auditEventPartition
  Roll` (07 §1) presupposes partitioning, so migration 0015 recreates `audit_events` as monthly RANGE
  partitions. The partition key must be in every unique key → **PK widened to `(id, created_at)`**
  (safe: nothing FKs to audit_events). A **default partition** guarantees an audit write never fails
  for want of a partition (a QMS must never drop the trail), and the nightly job **provisions the
  current + next month ahead** so the default stays empty in practice (adding a partition that would
  overlap default rows raises — staying ahead avoids it; a job outage > 1 month needs manual catch-up,
  logged in Known issues). Rows are **copied before `apply_tenant_rls`** because FORCE RLS binds the
  owner too. Append-only is re-applied on the parent; a BEFORE-ROW trigger on a partitioned parent
  cascades to all partitions. The two RLS enumerations (lint + suite) switched to
  `relkind IN ('r','p') AND NOT relispartition` so the **parent is verified and children skipped** —
  children carry no RLS because the parent's policy governs the only path the app can take (it has no
  grant on children); mutation-checked that breaking FORCE RLS on the parent still fails the lint. The
  roll job is **global, not per-tenant** (partitions span tenants) and runs on the **owner** connection
  (DDL + counting children directly, which the app cannot reach because the parent's FORCE RLS would
  block an owner `count(*)` through it). Tamper detection stores a **high-water count** per partition in
  the control-plane `control.audit_partition_stats`; a current count below it is the signal, and the
  stored mark is never lowered so the signal persists across runs. *Affects: 07 §1, 06 §1
  `housekeeping`, 02 §3.*

- **2026-07-23 — AI gateway: schema shape, ledger-not-audited, doc-summary auto-persist, budget
  opt-in, provider-outside-tx, no HTTP yet.** 06 §3 specifies the gateway's behaviour and enumerates
  `ai_invocations`' columns but 02-DATABASE defines no AI tables, so migration 0014's shapes were
  chosen and pinned: `ai_settings` (one row/tenant: `allow_ai`, `allow_cross_entity_context`,
  `pii_redaction`, `region_lock`), `ai_budgets` (one row/tenant/month; **absent row = unmetered** —
  budget governance is opt-in), `ai_invocations` (the AI audit trail + cost ledger). The ledger is
  written **directly, not through `withAudit`** — these rows ARE the AI audit trail and are telemetry,
  not entity mutations, exactly the notifications precedent; every gateway path still records exactly
  one row (`blocked`/`failed`/`succeeded`). The `intelligence` entitlement gates access via the
  existing `entitlements` table. `gateInvocation` **fails closed** in a fixed order (entitlement →
  kill switch → residency → budget); an unset budget is unmetered and a residency lock the provider's
  region can't satisfy refuses rather than routing cross-region. The provider is a pluggable port
  (`StubAiProvider` until a real one), and it is the ONLY model seam — no other module may import a
  model SDK (06 §3 chokepoint). The provider call runs **outside any DB transaction** (short read tx
  gates, model runs connection-free, short write tx records + charges) so latency never pins a pool
  connection. `doc_summary` — a bounded, low-risk AI-owned sidecar (`documents.ai_summary`), not a
  quality field — is **persisted directly** by the processor as a `system` `updated` event; the
  spec's "AI returns drafts a human accepts" applies to business-field drafting (root-cause/8D),
  which is the deferred draft-acceptance slice. No HTTP trigger yet: the gateway + processor are wired
  and tested, but the enqueue endpoint + provenance UI ship with the FE. *Affects: 06 §3, 07 §5,
  FEATURES §16.1.*

- **2026-07-23 — soft-delete purge: legal-hold `scope` shape, `purged` action, RESTRICT-skip, scope
  boundary.** `legal_holds.scope` is spec'd only as `jsonb` (07 §5), so the smallest useful shape was
  chosen and pinned in `packages/core/purge.ts`: `{}` = tenant-wide (aborts the whole run),
  `{entityKinds:[…]}` = whole kinds, `{entityKind[, entityId]}` = a kind or one row — using the
  singular audit entity-kinds (`ncr`, `inspection`, …), and any empty/unrecognised scope defaults to
  tenant-wide because the safe failure is to keep data. The permanent purge writes a NEW `purged`
  audit action (migration 0013 + `AuditAction`), distinct from `deleted` (the soft delete), so the
  trail separates "trashed" from "erased". Because every intra-tenant FK is `ON DELETE RESTRICT`
  (02 §7), each delete runs in its own SAVEPOINT and a still-referenced row skips on `23503` and
  purges on a later nightly run (children-before-parents ordering minimises the number of nights);
  this needs no cascade and can't orphan. Scope was bounded to the inspection/NCR/CAPA/audit/supplier
  record graphs + soft-deletable children + templates/plants/areas; `memberships`/`notification_prefs`/
  `sessions` (DSAR/offboarding lifecycle), `exports` (generated artifacts), and `documents`/`files`
  (dependents without an independent `deleted_at` — `document_versions`, `signatures` — plus the S3
  object) are excluded, the last as a tracked follow-up. `auditEventPartitionRoll` and `offboardTenant`
  (the other two `housekeeping` jobs) are deferred: the former needs `audit_events` converted to
  declarative time-partitioning first. *Affects: 06 §1 `housekeeping`, 07 §5.*

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

- **Web app (`apps/web`): foundation only; module screens + several cross-cutting systems pending.** The
  shell, design system, sign-in, and a dashboard slice are up and building, but most nav destinations are
  in-shell placeholders. Deliberately deferred from the foundation (all specified in 04, each lands with
  its module): (1) **i18n** — `next-intl` per 04 §8; strings are inline `en` for now. (2) **Real-time** —
  the WS connection + targeted TanStack Query invalidation + live-mode (04 §7). (3) **Command palette**
  (⌘K over `/v1/search`, 04 §3) — the top-bar search is a non-functional placeholder. (4) **Radix-based**
  dialogs/menus/tooltips (the profile menu is a lightweight custom popover for now; a real accessible menu
  wants Radix). (5) **Stale-write (409) reconcile, offline banner, and per-capability action hiding** — the
  loading/empty/error states exist on the dashboard; the other three UI states (04 §6) arrive with the
  first CRUD module. (6) **Sentry/OpenTelemetry** — the segment error boundary has the hook point.
  (7) **Playwright e2e** — none yet; `pnpm e2e` still unwired. (8) `allowUmdGlobalAccess` is on so
  components use the `React.*` type namespace without importing React — a DX choice, revisit if it ever
  masks a real missing import. *04 all sections.*

- **AI: chokepoint + HTTP surface + `doc_summary` ship; streaming, more features + a real provider are
  pending.** `POST /v1/ai/drafts` (all features) and `POST /v1/ai/summaries/accept` (`ai_draft_accepted`)
  now exist, and the `ai` queue's `generateSummary` runs. What remains: **SSE streaming** (the draft
  endpoint is synchronous — fine for the fast stub, but a real slow provider wants streaming, 06 §4);
  **acceptance on business fields** — only the document `ai_summary` sidecar has an accept path, while
  root-cause/8D-discipline drafting would accept into those entities through their own services;
  **feature processors** — `root_cause`/`eightd_draft`/`report_narrative`/`quicklog_structuring` are
  routable via the gateway (prompts exist) but have no dedicated processors, and `compliance_qa` needs
  pgvector embeddings over document chunks for retrieval; and the provider is still `StubAiProvider`
  (deterministic echo) — a real Anthropic-backed `AiProvider` with routing + failover is unbuilt. PII
  redaction masks emails/phones/caller-supplied terms; NER-based name detection of non-team members
  (06 §3.2) is not done — the caller passes `extraRedactionTerms`. *06 §3, FEATURES §16.1.*
- **Orphan cleanup handles never-completed uploads, not bucket→DB reconciliation.**
  `cleanupOrphanedUploads` now GCs `pending` `files` rows never completed (>24h) plus their objects.
  What it does NOT do is scan the bucket for objects with no `files` row at all — e.g. an object left by
  a soft-delete purge whose post-commit `Storage.delete` failed, or by any path that wrote bytes without
  a row. Full bucket-vs-DB reconciliation needs an object-list API on the `Storage` port (not yet
  present) and is a follow-up. Note a `file` pinned by a `signature` never becomes purgeable (retained
  evidence, correct) — its object is likewise retained. *06 §1 `files`.*
- **Offboarding retains `audit_events` and does not archive physical file objects.** The offboarding
  purge empties every tenant table EXCEPT the append-only `audit_events` (the app role can't delete it,
  and erasing an immutable trail warrants its own step — disable the trigger under an ACCESS EXCLUSIVE
  lock and batch-delete, or the Model-B database drop). The export bundle dumps every table to JSON
  (including `files` metadata) but does NOT copy the binary file objects from S3 ("+ all files" in
  01 §3.4) — the Storage port has no server-side copy and doing it well is an S3-to-S3 archival step;
  a follow-up. Also the purge runs in ONE transaction per tenant (atomic, but a very large tenant would
  want cross-transaction batching). Model B (`dedicated`) offboarding is a database drop instead — BUILT;
  see the Model B entry below. *01 §3.4, 07 §5.*
- **Model B (dedicated Postgres per tenant): local/self-hosted path COMPLETE; only the cloud
  secret-manager resolver remains.** 01 §3.1/§3.3 defines two isolation models on one codebase. Model A
  (shared Postgres + RLS) has always been the built path; Model B gives an Enterprise tenant its own
  database, same schema/migrations, different connection string. **Built so far:**
  (1) **request-path routing** — the lifecycle routes a `dedicated` tenant to a per-tenant pool
  (`TenantPoolManager`, LRU-capped ~20 via `TENANT_MAX_DEDICATED_POOLS`); `SecretResolver` turns
  `control.tenants.database_url_secret_ref` (a pointer, never the credential) into a connection string —
  `env:VAR` for cloud, `localdb:DB_NAME` (derive from `DATABASE_APP_URL`) for same-cluster; `withTenant(…, pool)`
  runs the same tenant-scoped tx (RLS still applies, defence in depth); a missing/unresolvable secret
  fails loud rather than leaking to the shared DB. (2) **provisioning** — `provision-tenant --model dedicated`
  now `CREATE DATABASE`s the tenant's DB, runs the full migration set against it (shared runner in
  `scripts/lib/migrate-runner.ts`), seeds defaults + smoke-tests isolation inside it, and registers it
  with a `localdb:` ref; the registry row is parked `provisioning_failed` until every step succeeds, then
  flipped `active` (so `resolveBySlug` never routes to a half-ready DB). (3) **migration fan-out** —
  `pnpm db:migrate:tenants` (`scripts/lib/fan-out.ts`) applies pending migrations to every dedicated DB
  under a per-DB advisory lock; a failed tenant halts its own rollout only and the CLI exits non-zero.
  (4) **job-path routing** — the worker resolves each per-tenant job's pool through a `RegistryDbRouter`
  (tenantId → model/secret, briefly cached) and every per-tenant processor forwards it to `withTenant`;
  the AI gateway takes an optional `pool` too (its self-managed txs), threaded from the worker and, on the
  request path, from the request context (`currentPool()`).
  (5) **drop-DB offboarding** — `offboardTenants` tears a dedicated tenant down by dropping its whole
  database (`DROP DATABASE IF EXISTS … WITH (FORCE)` on a raw owner connection, no tx wrapper) after the
  same hold-gate + export bundle, both read from the tenant's OWN database; the db name comes from the
  `localdb:` ref, `IF EXISTS` makes it resumable.
  (6) **audit-partition-roll fan-out** — the nightly roll now takes an optional owner pool and
  `fanOutAuditPartitionRoll` runs it once per dedicated DB (owner URL = primary migrator URL with the db
  name swapped), mirroring `db:migrate:tenants`; each dedicated DB tracks its own high-water marks.
  Proven by `apps/api/test/{tenant-pools,dedicated-routing,job-routing,audit-partition-fanout,offboard-dedicated}.test.ts`
  and `packages/db/test/dedicated-provision.test.ts`. **Remaining:** only the **cloud secret-manager
  resolver** — DDL/DROP and the owner-URL derivation are `localdb:` (same-cluster) only, so a cloud
  (`env:`) dedicated tenant can be routed for requests/jobs but not yet migrated, offboarded, or
  partition-rolled; an `awssm:`/`gcpsm:` `SecretResolver` plus a stored per-tenant owner URL drops in
  behind the same interfaces (a cloud `env:` tenant is left `offboarding` / collected as a fan-out
  failure until then, never silently mis-targeted). *01 §3.1, §3.3, §3.4, §3.5.*
- **Audit partition provisioning must stay ahead of the calendar.** The nightly roll provisions the
  current + next month; a default partition catches anything else so writes never fail. But if the job
  lapses for more than a month, rows for the un-provisioned month land in the default partition, and
  the roll then CANNOT create that month's explicit partition (Postgres refuses a new partition whose
  range overlaps existing default rows) — it needs a manual detach/migrate of the default's rows. The
  job logs and BullMQ dead-letters on that failure; a fully self-healing roll (split the default) is a
  follow-up. Also the per-partition tamper check does an exact `count(*)` per partition each night —
  fine at current scale; very large closed partitions may later warrant only re-counting recent ones.
  *07 §1.*
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
- **The PDF export is a simple tabular renderer, not the branded/Chromium one.** CSV, XLSX and a
  hand-rolled tabular PDF (Courier columns, paginated) all render behind the pipeline. The spec's rich
  PDF path — headless Chromium against the web app's print routes, driven by the PDF Template Designer
  (06 `reports` / 09) — is not built: it needs the Next.js print routes and a Chromium runtime, neither
  present in this backend repo. The tabular PDF is the interim; the branded one supersedes it when the
  FE + a render worker land. Also, export filters remain minimal (an optional `status`) — richer
  per-resource filters would mirror each list endpoint's query. *06 `reports`, 03 §8, 09.*
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
