# 01 — Architecture

## 1. Monorepo layout (Turborepo + pnpm)
Create exactly this structure. Package names are `@kaenal/<name>`.

```
kaenal/
├── apps/
│   ├── web/            # Next.js 14+ App Router — admin surface (all modules)
│   ├── mobile/         # Expo — field inspector app only
│   └── api/            # NestJS — REST API (contract-first OpenAPI)
├── packages/
│   ├── types/          # Zod schemas + inferred TS types + enums (single source of truth)
│   ├── core/           # Pure business logic: scoring, SLA math, 8D step rules, supplier weighting
│   ├── db/             # Drizzle schema, migrations, RLS policies, seed + provisioning scripts
│   ├── api-client/     # Generated typed client + TanStack Query hooks (used by web AND mobile)
│   └── config/         # Shared eslint, tsconfig, tailwind preset (design tokens)
├── turbo.json
├── pnpm-workspace.yaml
└── .github/workflows/ci.yml
```

Dependency direction (enforce with eslint-plugin-boundaries): `types` ← `core` ← `db`/`api-client` ← apps. Apps never import `db` directly except `api`. `core` and `types` import nothing workspace-internal and nothing platform-specific (no React, no Node APIs) — they must run in browser, RN, and Node.

## 2. Environments & configuration
- Environments: `local` (docker compose: postgres:16, redis:7, minio), `staging`, `production`.
- All config through env vars validated at boot with a Zod `EnvSchema` in each app; **crash on invalid/missing env at startup**, never at request time.
- Required API env: `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT/S3_BUCKET/S3_KEY/S3_SECRET`, `AUTH_SECRET`, `WORKOS_API_KEY` (Phase 4), `AI_GATEWAY_KEY` (Phase 4), `APP_BASE_URL`.
- Secrets never in the repo. `.env.example` lists every var with a comment.

## 3. Tenancy (the most important section in this file)

### 3.1 Model
Two isolation models, one codebase (see TECH_STACK.md §3):
- **Model A (default): shared Postgres + RLS.** Every tenant-owned table has `tenant_id uuid not null`. RLS policies filter by the session setting `app.tenant_id`.
- **Model B (Enterprise): dedicated Postgres per tenant.** Same schema/migrations, different connection string. No code changes.

### 3.2 Tenant registry (control plane)
A small, separate schema `control` (or separate DB in Model B world) holding:
```
control.tenants(id uuid pk, slug text unique, name text, model text check in ('shared','dedicated'),
                database_url_secret_ref text null, region text, status text check in ('active','suspended','offboarding'),
                created_at timestamptz)
```
- `slug` is the subdomain (`bosch` → `bosch.kaenal.app`). Validate: `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`, reserved list (`www`, `api`, `admin`, `app`, `status`, `docs`).
- The registry is the ONLY place that maps tenant → connection. Cache lookups in Redis with 60s TTL; bust on change.

### 3.3 Request lifecycle (API)
Every authenticated request MUST pass through, in order:
1. **Resolve tenant** from subdomain (or `X-Tenant-Id` for the mobile app) → registry lookup. Unknown/suspended tenant → `404 TENANT_NOT_FOUND` (never 403 — don't leak existence).
2. **Authenticate** session/JWT → `user_id`. Verify user belongs to that tenant (`memberships` table). Mismatch → 404 (same reason).
3. **Acquire DB connection** for the tenant (shared pool for Model A; per-tenant pool for Model B, LRU-capped at ~20 pools).
4. **`SET LOCAL app.tenant_id = '<uuid>'` and `SET LOCAL app.user_id = '<uuid>'`** inside the transaction — `SET LOCAL` so it can never leak across pooled connections. All queries for the request run in this transaction scope.
5. **RBAC guard** per route (matrix in 03).
6. Handler runs. Mutations write audit events in the same transaction.

Edge cases to handle here:
- Connection poolers (pgbouncer transaction mode) discard `SET` — this is WHY `SET LOCAL` + wrapping transaction is mandatory.
- A request with no tenant context (public routes: health, auth start, invite accept) uses a separate `publicDb` role with NO access to tenant tables.
- Background jobs have no request: every job payload carries `tenantId`, and the worker opens the same kind of scoped transaction before touching data.
- Cross-tenant admin (Kaenal staff support tooling) uses a dedicated `support` role + explicit `app.support_reason` audit field — never bypasses RLS silently.

### 3.4 Tenant provisioning script (`packages/db/scripts/provision-tenant.ts`)
One command: `pnpm provision-tenant --slug bosch --name "Bosch" --model shared --region eu-central-1`.
Steps (idempotent — safe to re-run): create registry row → (Model B: create database, run migrations) → seed defaults (roles, SLA config, notification prefs, inspection template examples) → run RLS smoke test (insert as tenant A, assert invisible as tenant B) → print admin invite link. Failure at any step rolls back the registry row to `status='provisioning_failed'`.

### 3.5 Offboarding
`pnpm offboard-tenant --slug bosch` → status `offboarding` (logins blocked) → full export to S3 (JSON per table + all files) → after a 30-day grace period, hard delete (Model A: `DELETE ... WHERE tenant_id`, in batches of 10k rows; Model B: drop database). Legal hold (see 07) blocks deletion.

## 4. Conventions
- **IDs:** `uuid v7` (time-ordered) for all PKs. Human-facing entity codes (`NCR-2026-0142`) are a separate `code` column, generated per-tenant per-year via a `counters` table incremented in the insert transaction (`UPDATE ... RETURNING` — no race, no gaps matter).
- **Time:** store `timestamptz` UTC everywhere; the tenant has a `timezone` setting used only for display and SLA business-hours math (in `packages/core`).
- **Money:** integer minor units + currency code. Never floats.
- **Enums:** defined once in `packages/types` as Zod enums; DB uses `text` + check constraint generated from the same list (Postgres enums are painful to migrate).
- **Soft delete:** `deleted_at timestamptz null` on user-facing entities; default queries filter it. Hard delete only via offboarding/DSAR.
- **Naming:** snake_case in DB, camelCase in TS; Drizzle maps between them.

## 5. CI (GitHub Actions)
Pipeline per PR: install → typecheck → lint → unit tests (Vitest) → `db:check` (every tenant table has tenant_id + RLS policy — script in 02 §6) → build all apps → Playwright smoke (web) against a docker-composed stack. Main branch: deploy staging automatically; production behind manual approval. Migrations run before app deploy, and must be backward-compatible with the previous app version (expand → migrate → contract pattern).
