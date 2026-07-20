# Claude Code — Kaenal Kickoff Prompt

Copy everything below the line into Claude Code, run from the Kaenal project root.

---

You are implementing **Kaenal**, a multi-tenant Quality & Safety Management SaaS for regulated manufacturing (IATF 16949 / ISO 9001). This repo contains the complete specification — read it before writing any code.

## Ground truth (read in this order, before coding)
1. `implementation/README.md` — build phases, non-negotiable rules, definition of done
2. `implementation/01-ARCHITECTURE.md` through `09-INTEGRATIONS.md` — the full spec (architecture, database+RLS, API, web, mobile, jobs/AI, security, testing, integrations)
3. `implementation/reference/FEATURES.md` + `TECH_STACK.md` — product scope and stack rationale
4. `project_brain/` — your own prior notes and decisions from earlier sessions. Read it, reconcile with the spec; if it conflicts with `implementation/`, the `implementation/` files win — note the conflict in the progress file rather than silently choosing.

The HTML prototype (`Kaenal.html`, `src/*.jsx`, `styles/tokens.css`) is the **visual spec only** — never copy it into the codebase; recreate screens per `04-WEB-APP.md`.

## Order of work
**Backend first, frontend second.** Follow the phases in `implementation/README.md`, but sequence within each phase as: database → API → (later) web UI.

1. **Phase 0 — Foundation (backend):** Turborepo + pnpm scaffold per 01 §1; `packages/types`, `packages/core`, `packages/db`; docker compose (postgres:16, redis:7, minio); Drizzle schema + migrations with **RLS on every tenant table** (exact SQL in 02 §1); tenant registry + provisioning script; auth (sessions, invitations, lockout); audit-trail plumbing (`withAudit`); CI with the RLS schema lint and tenancy test suite (08 §1.1). **Nothing else starts until the RLS suite passes.**
2. **Phase 1 backend:** contract-first API (ts-rest) for inspections, findings, NCR, CAPA, documents, files (presign flow), search, notifications — with RBAC guards (03 §3), state machines (02 §4), pagination/idempotency/optimistic concurrency (03 §5–6), and audit events on every mutation.
3. **Phase 1 frontend:** Next.js app shell (sidebar, topbar, command palette per 04 §3), design tokens from `implementation/reference/tokens.css`, then module by module: dashboard → inspections → NCR → CAPA → documents. Every list/detail implements all six UI states (04 §6).
4. Then Phase 2+ per the README (8D, audits, jobs/SLA, reports; mobile; platform/AI/integrations last).

## Progress tracking — mandatory
Maintain `PROGRESS.md` at the repo root. Update it **in the same commit** as the work. Structure:
```
# Kaenal Build Progress
## Current status: <one line — phase, what's in flight>
## Phase 0 — Foundation
- [x] Monorepo scaffold (2026-07-20) — notes/deviations
- [ ] RLS policies + schema lint
...one checklist per phase, mirroring the specs' sections...
## Decisions log
- 2026-07-20: <decision> — <why> — <spec section it affects>
## Known issues / TODO
## Conflicts found (project_brain vs implementation/)
```
At the START of every session: read `PROGRESS.md` first and resume from "Current status" — never re-plan from scratch. At the END of every session: update it so a fresh session can continue without any chat history.

## Working rules
- The **non-negotiable rules in `implementation/README.md`** apply to every commit (TypeScript strict, RLS + tenant_id on every table, audit event per mutation in-transaction, Zod validation from `packages/types`, no business logic in UI, pagination + idempotency, feature = migration+contract+UI+tests+audit).
- **Tests are not optional:** each backend module ships with its unit + integration tests per 08; run the RLS suite (08 §1.1) on every schema change.
- Work in small vertical slices: schema → contract → service → tests → (later) UI for ONE entity before starting the next.
- Commit frequently with conventional-commit messages; one logical change per commit.
- When the spec is ambiguous, make the smallest reasonable choice, record it in the Decisions log, and move on — don't stall.
- Never invent scope: if a feature isn't in `FEATURES.md`/the spec, put it in "Known issues / TODO" as a question instead of building it.
- Secrets only via `.env` (git-ignored) + `.env.example`; never commit credentials.

## Start now
1. Read the ground-truth files and `project_brain/`.
2. Create `PROGRESS.md` with the full phase checklists derived from the specs.
3. Begin Phase 0. First deliverable: running docker-compose stack + migrated database where the RLS tenancy test suite passes for two seeded tenants.
