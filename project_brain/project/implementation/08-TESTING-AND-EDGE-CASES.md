# 08 — Testing & Consolidated Edge-Case Register

## 1. Test strategy (Vitest unit · Playwright web e2e · Maestro mobile e2e)
Coverage philosophy: exhaustively test the **money layers** (tenancy, state machines, sync, SLA math, audit); smoke-test the UI.

### 1.1 RLS / tenancy suite (highest priority — runs on every PR)
Against a real Postgres (docker):
1. Seed tenants A and B with identical data shapes.
2. For EVERY tenant table (enumerated dynamically from `pg_tables`): as A, `SELECT count(*)` → only A's rows; attempt `INSERT` with B's tenant_id → rejected by WITH CHECK; attempt `UPDATE`/`DELETE` on B's row by id → 0 rows affected.
3. Query with NO `app.tenant_id` set → throws (not "returns everything").
4. API-level: authenticated as A, request B's entity by id → 404; reference B's id in a body (ownerId, ncrId) → 404/422.
5. Search/FTS, exports, sync endpoints, and WS channel auth each get an explicit cross-tenant probe.
A new table without RLS fails suite + the CI schema lint (02 §6) — two independent nets.

### 1.2 Unit (packages/core — pure, fast, exhaustive)
- State machines: full transition matrix per entity (legal + illegal), four-eyes rule, force-close paths.
- SLA math: `computeDueAt` across business hours, weekends, tenant timezones, and **DST transitions both directions**; at_risk/breached thresholds.
- Scoring: dynamic-form scoring incl. conditional items, N/A handling, weights, zero-weight edge (a section whose every item is N/A must not divide by zero).
- Supplier weighted score: weights that don't sum to 100 (normalize), a weight set to 0 (metric excluded — the prototype's tweak allows this), missing metric data (excluded + flagged, not treated as 0).
- Counters, code formatting, recurrence expansion (incl. Feb 29, month-end "31st" rules → last day).

### 1.3 API integration (Vitest + supertest against docker stack)
Per module: CRUD happy path, validation failures (422 shape), pagination cursors (stable under concurrent inserts), optimistic-concurrency 409, idempotency replay, RBAC per role (parameterized over the matrix in 03 §3), audit event written per mutation (assert row exists in same-transaction test), bulk partial failure.

### 1.4 Sync protocol tests (deterministic, no devices needed)
Simulate the queue against the API: offline create → replay with idempotency (run twice, one row); disjoint-field merge; same-field conflict per policy class; rejected transition surfaces `failed` with reason; dependency ordering (file before referencing mutation); tombstone pull removes local row.

### 1.5 E2E (Playwright)
The MVP definition-of-done flow as one scripted journey: provision tenant → invite user → create template → schedule inspection → complete with failed item → create NCR from finding → assign → (clock-skip helper) SLA escalates → CAPA created and closed → audit trail shows every step. Plus: auth flows (lockout, reset), palette entity search, kanban transition + illegal drop, dark mode + density persistence, deep links with filters, 404-in-shell.

### 1.6 Load & soak (before first paying tenant)
k6: 200 concurrent users mixed read/write on one shared instance; assert p95 < 300ms reads / < 600ms writes; SLA job fan-out with 1k tenants completes < 5 min; WS 5k concurrent connections.

## 2. Consolidated edge-case register
(Details live in the referenced file; this is the master checklist — every item needs a test or an explicit "accepted risk" note.)

**Tenancy & auth** (01, 03, 07)
- [ ] Unknown/suspended tenant subdomain → 404, no existence leak
- [ ] User in two tenants → workspace picker; session bound to ONE tenant
- [ ] `SET LOCAL` under pgbouncer transaction pooling — no cross-request leakage
- [ ] Jobs/support/public paths each have explicit tenant context rules
- [ ] Last-admin protection; role change mid-session; deactivated user with open items
- [ ] Reserved/invalid tenant slugs; provisioning idempotent re-run; offboarding vs legal hold

**Data & workflow** (02)
- [ ] Entity code counter race + year rollover
- [ ] Published template immutability; in-flight inspection pins version
- [ ] Illegal status transitions → 409 with allowed list; four-eyes verify
- [ ] Soft-deleted source entity keeps NCR link ("(deleted)")
- [ ] jsonb never stores file bytes; FK RESTRICT everywhere

**API** (03)
- [ ] Cross-tenant id in request body → 404/422
- [ ] Stale write (two tabs) → 409 merge flow
- [ ] Idempotency replay returns original response
- [ ] Bulk partial failure per-item results
- [ ] Export > 100k rows → chunked zip; exports are async jobs
- [ ] DST-spanning due-date math

**Files** (03, 07)
- [ ] Orphaned pending uploads cleaned; AV-infected quarantined; SVG sanitized
- [ ] EXIF GPS kept for evidence, stripped for avatars
- [ ] Presigned URLs short-TTL, requested per download, audited for controlled docs
- [ ] Signature hash invalidated by post-sign content/file change

**Mobile & sync** (05)
- [ ] Kill mid-inspection → resume; storage pressure never evicts unsynced evidence
- [ ] Same-field conflict policies (responses / transitions / free text)
- [ ] Rejected mutation never silently dropped; sign-out blocked with pending queue
- [ ] Expired refresh token offline → local read-only, no wipe
- [ ] Presign at push time, not capture time

**Jobs, realtime, AI** (06)
- [ ] All jobs idempotent; notification dedupe key; outbox after-commit publishing
- [ ] WS channel auth blocks foreign tenant subscription; thin payloads only
- [ ] AI: entitlement + budget gate; RLS-scoped context; prompt-injection-as-data; drafts never auto-applied; regional lock
- [ ] Redis outage: rate limits fail open (authed) / closed (auth endpoints)

**Compliance** (07)
- [ ] Audit events append-only (role + trigger + shrink monitor)
- [ ] DSAR anonymizes personal data, retains quality records
- [ ] Legal hold blocks purge/offboarding
- [ ] Support access time-boxed, reasoned, tenant-visible

## 3. Release gates
A release ships only when: CI green (typecheck, lint, unit, RLS suite, schema lint, e2e smoke) · no open criticals from dependency/SAST scans · migrations applied to staging + smoke passed · edge-case register items touched by the change have tests · CHANGELOG entry written (feeds the in-app release notes module).
