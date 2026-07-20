# CLAUDE.md — Kaenal

Kaenal is a multi-tenant Quality & Safety Management SaaS (QMS) for regulated manufacturing (IATF 16949 / ISO 9001).

## Ground truth
All spec paths below are relative to `project_brain/project/`.

- `project_brain/project/implementation/` is the canonical spec: README (phases + rules), 01-Architecture, 02-Database, 03-API, 04-Web, 05-Mobile, 06-Jobs/AI, 07-Security, 08-Testing, 09-Integrations. Reference copies of FEATURES.md, TECH_STACK.md and tokens.css live in its `reference/` subfolder.
- `project_brain/` also holds prior session notes. On conflict, `implementation/` wins — log the conflict in PROGRESS.md.
- `project_brain/project/Kaenal.html` + `project_brain/project/src/*.jsx` + `project_brain/project/styles/tokens.css` are the VISUAL spec only. Never copy prototype code into the codebase; recreate screens per `implementation/04-WEB-APP.md`.
- `project_brain/README.md` is a Claude Design handoff note describing the design-bundle workflow, not this build. Superseded by this file.

## Session protocol
- START: read `PROGRESS.md`, resume from "Current status". Never re-plan from scratch.
- END: update `PROGRESS.md` (checklists, decisions log, known issues) in the same commit as the work.
- Build order: backend before frontend; within a phase: database → API → UI. Phases per `implementation/README.md`.

## Non-negotiable rules (every commit)
1. TypeScript strict; no `any`.
2. Every tenant-owned table has `tenant_id` + forced RLS policy + leading-tenant_id index (exact SQL: 02 §1). Run the RLS test suite on every schema change.
3. Every mutation writes an audit event in the same DB transaction (`withAudit`).
4. All validation via Zod schemas in `packages/types`, shared by API/web/mobile.
5. No business logic in UI components — it lives in `packages/core` or the API.
6. Every list endpoint paginated (cursor); every create idempotency-safe; writes use optimistic concurrency (03 §5–6).
7. A feature = migration + API contract + UI + tests + audit events. Missing any → not done.
8. Never reveal cross-tenant existence: foreign-tenant ids → 404, not 403.

## Working rules
- Vertical slices: schema → contract → service → tests → UI for ONE entity before the next.
- Small conventional commits; tests ship with the module, not later.
- Ambiguity: make the smallest reasonable choice, record it in PROGRESS.md Decisions log, move on.
- No invented scope: if it's not in `implementation/` or `FEATURES.md`, add it to Known issues as a question.
- Secrets only in git-ignored `.env`; keep `.env.example` current. Never commit credentials or log tokens/PII.

## Stack (details in `project_brain/project/implementation/reference/TECH_STACK.md`)
Turborepo + pnpm · NestJS + ts-rest (contract-first OpenAPI) · Postgres 16 + RLS + Drizzle · Redis + BullMQ · S3/MinIO · Next.js (App Router, Tailwind + shadcn/ui, TanStack Query/Table) · Expo (mobile, offline SQLite sync) · Vitest / Playwright / Maestro.

## Commands (keep current as scaffolding lands)
- `corepack enable && pnpm install` — pnpm is not installed globally; corepack provides it
- `docker compose up -d` — postgres:16 (port 5433), redis:7 (6380), minio (9000/9001). Non-default ports avoid collisions with local services.
- `pnpm db:migrate` — applies `packages/db/migrations/*.sql` in order
- `pnpm db:check` — RLS schema lint (02 §6); `pnpm db:reset` — drop schema, local only
- `pnpm provision-tenant --slug acme --name "Acme" --model shared`
- `pnpm test` (unit) / `pnpm test:rls` (tenancy suite) / `pnpm e2e` (not yet wired)

Both isolation nets are mutation-tested — if you change RLS, prove the suite still fails when
isolation is broken, not just that it passes.
