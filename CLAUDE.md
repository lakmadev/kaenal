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

## Settled architecture decisions (do not re-litigate; see PROGRESS.md Decisions log for why)
- **Identity is shared, not per-tenant.** A person is one row in `control.users` (email globally
  unique, holds the credential/MFA/lockout). A `membership` is the person in one tenant (role,
  plant scope, per-tenant status). This resolves the 02 §2 vs 07 §7 conflict in favour of 07 §7
  (one login, workspace picker, cross-tenant invites). `control.users` is outside RLS, so it has
  its own explicit access tests (`packages/db/test/control-identity.test.ts`) — keep them green.
- **Every user reference in a tenant table is a composite FK** `(tenant_id, col) → memberships
  (tenant_id, user_id)`, not a plain FK to `control.users`. This is what replaces the RLS
  invisibility that used to prevent cross-tenant user references — do not "simplify" it to a
  single-column FK (a mutation test proves that regresses).
- **The request lifecycle is ONE interceptor** (`apps/api/src/lifecycle.interceptor.ts`), not
  middleware + guards, so authentication and RBAC run INSIDE the tenant-scoped transaction. Routes
  are default-deny: `@Public` (no tenant, no session), `@AllowAnonymous` (tenant + scoped tx, no
  session — sign-in, accept-invite), or authenticated (+ optional `@RequireCapability`).
- **Integration tests share one Postgres**, so `pnpm test` runs packages serially
  (`--concurrency=1`). Each suite must seed and clean up its own fixtures.

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
- `pnpm --filter @kaenal/api dev` (API :3001) · `pnpm --filter @kaenal/web dev` (web :3000)
  — the web app proxies `/api/*` to the API (same-origin cookies). Web engineering docs:
  `apps/web/README.md`, `apps/web/docs/rules.md`, `apps/web/docs/best-practices.md`.
  Visual truth is `styles/tokens.css` + `Kaenal.html` + `src/*.jsx`; 04 §2's literal palette
  (blue accent, Inter) is SUPERSEDED by tokens.css (ink accent, Archivo) — see PROGRESS.md.

Both isolation nets are mutation-tested — if you change RLS, prove the suite still fails when
isolation is broken, not just that it passes.
