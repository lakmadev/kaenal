# TODO — Kaenal

Running backlog of work we know we need to do. Grouped by theme; **enterprise-readiness**
is the current focus (from the 2026-08-06 backend assessment). Check items off as they land;
add new ones as they surface. See `PROGRESS.md` for what's already done and the decisions log.

Status key: `[ ]` open · `[~]` in progress · `[x]` done

---

## Enterprise readiness (backend)

The domain core is strong (forced RLS + mutation-tested isolation, in-tx audit events,
capability RBAC + `@Internal`, MFA/CSRF/rate-limiting, idempotency, optimistic concurrency,
health + graceful shutdown, BullMQ retries/DLQ). The gaps are in operational + integration
seams, not domain logic.

### Tier 1 — block the first paying enterprise tenant
- [ ] **Real delivery adapters (email/SMS/push).** Replace `StubDelivery`
      (`apps/api/src/jobs/ports.ts:41`) with a real transactional provider (SES/Postmark/
      SendGrid) behind the existing port. Invites/password-resets must actually email the
      token (today returned in the response in non-prod). Add templates + bounce/suppression.
- [ ] **Production observability.** OpenTelemetry traces + RED metrics on HTTP and each job,
      DB/pool + Redis queue-depth gauges, and error aggregation (Sentry or equiv) with
      alerting. Today: structured error logs + `requestId` only, no metrics/tracing.
- [ ] **Secrets management.** Move off plaintext `.env` to Vault / AWS Secrets Manager / SSM
      with rotation. Wire the real resolver behind the existing `databaseUrlSecretRef` seam.

### Tier 2 — before scaling past the first few tenants
- [ ] **CI security gates.** Add to `.github/workflows/ci.yml`: `pnpm audit`/OSV, SAST
      (CodeQL or Semgrep), secret scanning (gitleaks), image/container scan (Trivy), and
      Dependabot. Cheapest, highest-signal item on this list.
- [ ] **Backup / DR runbook.** Document PITR, RPO/RTO, and a *tested* restore. Add an
      expand/contract migration discipline doc for zero-downtime deploys.
- [ ] **Enterprise SSO + SCIM.** SAML/OIDC SSO and SCIM provisioning/deprovisioning on the
      shared-identity (`control.users`) foundation. Large lift; often a procurement gate —
      start the design early.

### Tier 3 — regulated-industry polish (IATF/ISO auditors)
- [ ] **E-signature semantics** on approvals — a formal signed record capturing intent/meaning
      (beyond four-eyes + approver-role). 21 CFR Part 11 if any FDA-adjacent customers.
- [ ] **Data retention policy** for audit events beyond partition roll; documented periodic
      access-review process.
- [ ] **e2e + load/soak tests.** Wire `pnpm e2e` (currently unwired); add a load/soak test to
      establish capacity + correct DB pool sizing.

---

## Admin/platform functional slices (Claude Design 5-phase handoff → `ADMIN_PLATFORM_PLAN.md`)

Net-new vertical slices (migration+RLS+contract+service+tests+audit+UI), backend-first, one at a
time. Tasks #30–35.
- [x] **Phase A — `tenant_settings` foundation + White-label branding.** Reusable settings table;
      branding editor (settings:manage) reflected in the shell wordmark. Browser-verified.
  - [ ] Follow-up: apply branding **colours** to the live runtime theme (currently stored + previewed).
  - [ ] Follow-up: branded **pre-auth login page** (needs a public-by-slug branding read — rule-8
        existence-leak care) + wire `loginTagline`/`footer`/`domain`.
  - [ ] Follow-up: **logo/favicon upload** backend (file storage + render); domain-verify + SPF/DKIM
        chips are presentational until a DNS/verify service exists.
- [x] **Phase B** — NCR validation rules (enforced on NCR create). Browser-verified.
  - [ ] Follow-up: enforce `warn`/`escalate` actions (warning channel + escalation job) and add
        `transition`/`disposition`/`close` triggers (only create-time `block` is enforced today).
  - [ ] Follow-up: "recent validation events" table (needs a validation-event log — omitted, not faked).
- [x] **Phase C** — Session policies (absolute timeout + max-concurrent enforced at sign-in).
      Browser-verified.
  - [ ] Follow-up: enforce **web idle timeout** (per-request `last_seen_at` on sessions) and
        **mobile idle**; wire **remember-device** ("trust this device" flow) and **step-up re-auth**
        (per-operation challenge) — stored today, not enforced.
  - [ ] Follow-up: the design's workforce-safety detections (off-hours, impossible-travel,
        suspicious-pattern lockout, managed-device-only) + biometric/wipe are UI-only stubs.
- [x] **Phase D** — Legal hold + DLP policies (compliance). Legal hold is built on the enforced
      `legal_holds` table (0001) with a structured scope (workspace / entity-kinds / one-record),
      so active holds genuinely block the nightly purge; DLP is a new stored register.
      Browser-verified end-to-end (create → list) on both.
  - [ ] Follow-up (DLP): wire real pre-egress interception + hit metrics + a "recent events" log
        (the design's stat cards + events table were omitted, not faked — no interception layer yet).
  - [ ] Follow-up (Legal hold): custodian-acknowledgment sub-entity + notify flow, and frozen-record
        / storage counters (need metering) — omitted from the design, not faked.
  - [ ] **HIGH — pre-existing, surfaced during Phase D:** the RLS tenancy suite
        (`packages/db/test/rls.test.ts`, `pnpm test:rls`) — the codebase's highest-priority,
        mutation-tested safety net — has been RED since **Phase A** and isn't in the `pnpm test`
        gate, so it went unnoticed. Root cause: it assumes every tenant table has a single-column
        `id`; `tenant_settings` (0025, composite PK `(tenant_id, namespace)`, no `id`) makes
        `SELECT id FROM tenant_settings` throw in `beforeAll`, aborting the suite. Also
        `ncr_validation_rules` (0026) + `dlp_policies` (0028) lack `seedTenant()` fixtures.
        Fix = generalize the id-probes to primary-key columns + seed those tables (watch the
        composite-PK clone WITH-CHECK vs unique-violation ordering) + add `test:rls` to the gate.
        Phase D isolation is independently proven: `db:check` forced-RLS lint (40 tables) +
        cross-tenant API tests in `settings.test.ts` for both new tables.
- [x] **Phase E** — Cost centers & chargeback. Real tenant cost-center hierarchy (0029) that
      memberships are assigned to; seats are a live count. Chargeback is COMPUTED server-side —
      seats × rate + a shared platform fee split with a conserved-total apportionment
      (`packages/core/chargeback.ts`, unit-tested). Browser-verified end-to-end (create CC → assign
      member → chargeback computed, conserved).
  - [ ] Follow-up: meter real AI + storage usage (attribute `ai_invocations` / `files` to the
        member/record cost center per the stored allocation strategy) — reported as 0 today, flagged
        in the UI. Then the AI/Storage columns + the design's Export-GL / Send-to-NetSuite / Finalize
        actions become real (omitted for now, not faked).
  - [ ] Follow-up: cycle-safe reparenting (only direct self-parent is blocked today; a deep cycle via
        a chain of parents is possible in the API — the 2-level admin UI doesn't create them).
- [x] **Phase F** — FMEA workbench (new QMS module; closes P13). New `fmeas` + `fmea_items` tables,
      `fmea:view`/`fmea:manage` capabilities, full CRUD, and a real `/fmea` route (out of the
      placeholder). RPN (S×O×D) + Action Priority (H/M/L) derived in `packages/core/fmea.ts` and
      previewed live in the editor via the same functions. Browser-verified end-to-end (create FMEA →
      add failure mode → S9×O4×D3 → RPN 108 / HIGH → distribution 1 High).
  - [ ] Follow-up: replace the SIMPLIFIED Action-Priority rule with the full certified AIAG/VDA 2019
        (S,O,D) lookup table (the current rule is the one the design states in its own UI note, clearly
        labelled — the full table is a larger, verification-heavy transcription).
  - [ ] Follow-up: the design's **Export AIAG form** (XLSX) action — needs an FMEA XLSX exporter
        (omitted, not faked). Also DFMEA-specific columns, recommended-action completion tracking with
        after-action re-scoring / risk-reduction %, and control linking to SPC/inspections.

---

## Product backlog (from PROGRESS.md roadmap)

- [ ] **P11 finish:** seed a demo `partner` account so the supplier portal is viewable in dev
      (no partner accounts exist locally today).
- [ ] Tier-2 modules (backends are `PROPOSED`, no FE): P12 Risk register · P13 FMEA · P14 SPC ·
      P15 MSA · P16 Calibration · P17 Training · P18 Complaints · P19 ECN.
- [ ] Advanced: P20 Knowledge graph · P21 Predictive risk (feeds PPAP/SCAR prediction stubs) ·
      P22 Reporting/BI · P23 AI assistant · P24 PDF designer.
- [ ] Smaller deferred: nightly `supplier-scorecard` flag/insight job (P08); PPAP & SCAR
      activity-history timeline UIs (data is in `audit_events`).
- [ ] Web cross-cutting (deferred from foundation): i18n (`next-intl`), real-time WS + live-mode,
      Radix dialogs/menus, 409 reconcile / offline banner, Sentry/OTel on web.

---

## Deployment

- [x] **Dockerfiles scaffolded + build-verified** — `Dockerfile.api`, `Dockerfile.worker`,
      `Dockerfile.web` (+ `.dockerignore`). API/worker run TS via `tsx`; web via `next build`/
      `next start`. Node 22 / pnpm 9.15.4 pinned; glibc base for native `argon2`. Both images
      built and smoke-tested (API boots to env-validation; web serves). See `DEPLOYMENT.md`.
- [x] **Deployment standards doc** — `DEPLOYMENT.md` (build/run rules, env contract, DB roles,
      migration-as-release-step, health checks, rollback). Source of truth for every deploy.
- [ ] **Pick platform + first deploy.** Leaning Render (managed Postgres/Redis + first-class
      background workers + cron; least ops for a solo builder). Provision Postgres/Redis + an
      S3 bucket (R2), wire env per `DEPLOYMENT.md`, deploy the three images, run the migration
      release step.
- [ ] **`render.yaml` (or `fly.toml`) IaC** once the platform is chosen, so the topology is
      reproducible (web service + api service + background worker + release/migrate command).
- [ ] Consider Next `output: "standalone"` (+ `outputFileTracingRoot`) to slim the web image.

## Known gaps / cleanups
- [ ] Decide whether to lock `/v1/notifications` for partners (currently intentionally open —
      per-user/self-scoped; P11 spec lists supplier notifications).
- [ ] Local-only test teardown FK flakes in `auth.test`/`audits.test` (demo-seed collisions;
      not a CI issue). Low priority.
