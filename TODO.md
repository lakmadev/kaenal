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
