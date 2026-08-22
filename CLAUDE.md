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
0. **NEVER EVER HALLUCINATE AND START YOUR OWN IMPLEMENTATION. ALWAYS OBEY WHAT IS GIVEN. IF A
   DESIGN IS GIVEN AND ASKED TO IMPLEMENT, ALWAYS IMPLEMENT PIXEL TO PIXEL INCLUDING FULLY
   FUNCTIONAL BACKEND WITHOUT MESSING WEB AND MOBILE PLATFORMS.** A designed element is never
   "buildable but skipped" or "deferred to the web app." If the backend it needs does not exist,
   **design and build that backend** (migration + contract/REST route + service + tests) as part of
   the same work. If mobile needs a shape the web endpoint doesn't return, **add a mobile-appropriate
   endpoint or field** — never degrade the web API and never reshape web behaviour to serve mobile.
   Web and mobile are independent surfaces that may have their own endpoints; keep both fully working.
1. TypeScript strict; no `any`.
2. Every tenant-owned table has `tenant_id` + forced RLS policy + leading-tenant_id index (exact SQL: 02 §1). Run the RLS test suite on every schema change.
3. Every mutation writes an audit event in the same DB transaction (`withAudit`).
4. All validation via Zod schemas in `packages/types`, shared by API/web/mobile.
5. No business logic in UI components — it lives in `packages/core` or the API.
6. Every list endpoint paginated (cursor); every create idempotency-safe; writes use optimistic concurrency (03 §5–6).
7. A feature = migration + API contract + UI + tests + audit events. Missing any → not done.
8. Never reveal cross-tenant existence: foreign-tenant ids → 404, not 403.
9. **Design fidelity is a completion gate.** Any screen with a `project_brain/project/src/*.jsx`
   (web) or `project_brain/mobile/src/m-*.jsx` (mobile) design MUST match that jsx pixel-for-pixel —
   every view, panel, and state, not a simplified subset. Read the whole jsx first, reproduce all of
   it, verify in-browser side-by-side. A screen that diverges from its jsx is a defect. Full rule +
   process: `apps/web/docs/design-rules.md`. You may not silently simplify or drop a designed element
   — surface it and get sign-off first.
10. **Never fake, never stub, never hallucinate a feature.** A control the design shows (a button,
    toggle, form, screen) must be *wired to real behaviour* before the screen is "done" — not a dead
    row, not an `alert("managed in the desktop app")`, not a placeholder. Before claiming a feature
    can't be built, PROVE the gap: grep the ts-rest contract AND the NestJS controllers
    (`apps/api/src/**/*.controller.ts`) — many real endpoints (change-password, MFA enroll/activate/
    disable, recovery-codes, sessions list/revoke) live as plain REST routes OUTSIDE the ts-rest
    contract and are callable via `fetch` (see `apps/mobile/src/lib/auth-api.ts`). Only when an
    endpoint genuinely does not exist may you defer — and then you flag it honestly in
    `progress_mobile.md` "Known issues", never disguise it as working. Deferring designed, buildable
    behaviour to "the web app" is a defect, not a decision.
11. **The mobile app must feel native, edge-to-edge, on device AND as an installed PWA.** Full
    height (`100dvh`), `viewport-fit=cover`, real safe-area insets (top notch + bottom home indicator)
    honoured on iOS/Android standalone (Add to Home Screen) and native builds alike. A screen that
    letterboxes or clips at the system insets is a defect.
12. **NEVER MESS UP SIGN-IN.** The dev login must keep working after every change. The #1 cause of
    "login stopped working" is running the test suite: its teardown does
    `TRUNCATE … control.users CASCADE` on the SHARED dev Postgres, wiping the seeded demo accounts.
    So after `pnpm test` / `pnpm test:rls` (or anything that resets the DB), **re-seed the login** with
    `pnpm --filter @kaenal/api exec tsx scripts/seed-demo.ts` (→ `demo@acme.test` / `demo-password-1234`,
    workspace `acme`) and confirm a real sign-in returns 201 before calling the work done. Never change
    auth (`apps/api/src/auth/**`, the lifecycle interceptor, session cookies/CSRF, the sign-in screen)
    without proving sign-in still works end to end.

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
- `pnpm test` (unit) / `pnpm test:rls` (tenancy suite) / `pnpm e2e` (Playwright golden-path;
  needs the stack up + demo seeded — see `apps/web/e2e/README.md`; full-stack CI job is a follow-up)
  — ⚠ both TRUNCATE `control.users` on the shared dev DB, so they **break the dev login**. Re-seed
  after: `pnpm --filter @kaenal/api exec tsx scripts/seed-demo.ts` (see rule #12).
- `pnpm --filter @kaenal/api dev` (API :3001) · `pnpm --filter @kaenal/web dev` (web :3000)
  — the web app proxies `/api/*` to the API (same-origin cookies). Web engineering docs:
  `apps/web/README.md`, `apps/web/docs/rules.md`, `apps/web/docs/best-practices.md`,
  `apps/web/docs/design-rules.md` (**jsx = pixel-for-pixel binding design; rule #9**).
  Visual truth is `styles/tokens.css` + `Kaenal.html` + `src/*.jsx`; 04 §2's literal palette
  (blue accent, Inter) is SUPERSEDED by tokens.css (ink accent, Archivo) — see PROGRESS.md.

Both isolation nets are mutation-tested — if you change RLS, prove the suite still fails when
isolation is broken, not just that it passes.
