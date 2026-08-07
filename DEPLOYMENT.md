# DEPLOYMENT — rules & standards

**This is the single source of truth for deploying Kaenal. Read it before any deploy and
follow it exactly — do not improvise a build/run command.** If something here is wrong or
missing, fix *this file* first, then deploy. Every rule below was verified against the actual
repo (build tooling, `apps/api/src/env.ts`, `next.config`), not assumed.

---

## 0. Golden rules (the non-negotiables)

1. **The deploy artifact is a Docker image.** Always build from the repo-root Dockerfiles
   (`Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.web`). The *same image* runs on any
   platform (Render/Fly today, AWS ECS later) — this is what keeps us portable. Never deploy
   via a platform's auto-detected buildpack.
2. **Config comes from the environment, never the image.** No secrets, no `.env` files baked
   in (`.dockerignore` enforces this). Every value is injected by the platform at runtime.
3. **The API/worker run from TypeScript source via `tsx`** — NOT `node dist/`. The workspace
   packages (`@kaenal/core|db|types|api-client`) ship raw TS (`main → src/index.ts`, no build
   step), so a compiled `dist/main.js` cannot resolve them. This is by design. If you ever want
   `node dist/`, you must first give every package a real build + `dist` + conditional exports.
4. **Migrations are a separate, gated release step** — never auto-run on app boot (see §5).
5. **Pinned toolchain:** Node **22** (bookworm/glibc — required for the native `argon2`),
   pnpm **9.15.4** (via corepack). Don't drift these without updating all three Dockerfiles.

---

## 1. What runs (process model)

| Process | Image | Command (baked into image) | Port | Notes |
|---|---|---|---|---|
| **web** | `Dockerfile.web` | `next start -p 3000 -H 0.0.0.0` | 3000 | The only public entrypoint. Proxies `/api/*` to the API server-side. |
| **api** | `Dockerfile.api` | `tsx src/main.ts` | 3001 | HTTP API. Same-origin with web via the proxy. |
| **worker** | `Dockerfile.worker` | `tsx src/jobs/worker.ts` | — | Background jobs (BullMQ). No HTTP port. `JOBS_ENABLED=true` baked in. |

**External managed dependencies (provision these on the platform):**

- **PostgreSQL 16** — with the three DB roles below.
- **Redis 7** — BullMQ backing + rate-limit + idempotency store.
- **S3-compatible object storage** — AWS S3 / Cloudflare R2 / Fly Tigris / MinIO.

Only **web:3000** needs to be internet-facing. api + worker + datastores stay on the private
network.

---

## 2. Build commands

```bash
# context is the repo root for all three
docker build -f Dockerfile.api    -t kaenal-api:<tag>    .
docker build -f Dockerfile.worker -t kaenal-worker:<tag> .
docker build -f Dockerfile.web    -t kaenal-web:<tag>    .
```

- `<tag>` = the git SHA (e.g. `ab338f1`). Never deploy `:latest` to an environment you care about.
- The API/worker images need build tools (for `argon2`) — already handled in their `deps` stage.
- The web image needs **no secrets at build time** (the API is reached at runtime via `API_ORIGIN`).

---

## 3. Environment contract

Parsed once at boot by `apps/api/src/env.ts`; **the process exits if anything required is
missing or malformed** (a deploy mistake becomes a container that never accepts traffic, not a
500 on a customer request). Keep `.env.example` current as the canonical list.

### API + worker — **required** (no defaults)
| Var | Meaning |
|---|---|
| `DATABASE_URL` | Migrator role (BYPASSRLS) — control schema + migrations. |
| `DATABASE_APP_URL` | App role — **RLS-forced**; all tenant queries. |
| `DATABASE_PUBLIC_URL` | Public role. |
| `REDIS_URL` | Redis connection. |
| `AUTH_SECRET` | ≥ 32 bytes. Generate: `openssl rand -base64 32`. |
| `APP_BASE_URL` | Public base URL of the app (absolute). |

### API + worker — should set in production (have dev defaults)
| Var | Default | Prod guidance |
|---|---|---|
| `NODE_ENV` | `development` | `production` (already baked into runtime images). |
| `PORT` | `3001` | leave as 3001. |
| `TENANT_ROOT_DOMAIN` | `kaenal.local` | your apex, e.g. `kaenal.app` (subdomain→tenant). |
| `S3_ENDPOINT` | MinIO local | your bucket's endpoint. |
| `S3_BUCKET` `S3_KEY` `S3_SECRET` `S3_REGION` | local MinIO | real bucket creds. |
| `S3_FORCE_PATH_STYLE` | `true` | `true` for MinIO/R2 path-style; `false` for AWS S3 vhost. |
| `S3_URL_TTL_SECONDS` | `900` | keep unless you have a reason. |
| `JOBS_ENABLED` | on (non-test) | `true` on the worker (baked in) and the API (it enqueues). |
| `RATE_LIMIT_ENABLED` | on (non-test) | `true`. |
| `LOG_LEVEL` | `info` | `info` or `warn`. |
| `TENANT_CACHE_TTL_SECONDS` / `TENANT_MAX_DEDICATED_POOLS` | 60 / 20 | tune only for dedicated-tenant hosting. |

### Web — runtime
| Var | Meaning |
|---|---|
| `API_ORIGIN` | Where the web server proxies `/api/*` (e.g. `http://api.internal:3001`). Default `http://localhost:3001`. |

> The browser never calls the API directly — it hits the web origin and Next proxies to
> `API_ORIGIN`, keeping the session cookie + CSRF same-origin. So expose only web publicly.

---

## 4. Database roles (three, by design)

The app separates DB privileges (see CLAUDE.md "Settled architecture"): the **app pool uses an
RLS-forced role** (`kaenal_app`), the **migrator role bypasses RLS** (`kaenal_migrator`) for
the control schema + migrations, and a **public role** (`kaenal_public`). On a managed Postgres
you must create these roles and point each `DATABASE_*_URL` at the right one. Never point the
app at the migrator role — that would defeat RLS, the core tenant-isolation mechanism.

---

## 5. Release process (ordered)

Run **once per release, before** the new app version takes traffic. Migrations are forward-only.

1. **Migrate:** `pnpm db:migrate` (applies `packages/db/migrations/*.sql` in order, via the
   migrator role). Run this as a platform **release/pre-deploy command or a one-off job** — from
   the API image (it has the db package + tsx). Do **not** auto-migrate on app boot: multiple
   app instances would race, and a bad migration would take down every replica at once.
2. **Deploy** the new `api`, `worker`, `web` images (same tag).
3. **Verify** readiness (below) before shifting traffic.

For zero-downtime, follow **expand/contract**: a migration must be compatible with the currently
running app version (add columns/tables first, backfill, switch reads, drop later) — never a
breaking change deployed in the same step as the code that needs it.

---

## 6. Health checks & ports

| Service | Liveness | Readiness | Port |
|---|---|---|---|
| api | `GET /healthz` (process up) | `GET /readyz` (checks DB + Redis) | 3001 |
| web | `GET /` (200/307) | same | 3000 |
| worker | process liveness only (no HTTP) | — | — |

Point the platform's health check at **`/readyz`** for the API so it only receives traffic once
DB + Redis are reachable.

---

## 7. Secrets

- Store every secret in the platform's secret manager (Render env groups / Fly secrets / AWS
  Secrets Manager). Never in the repo, the image, or plaintext `.env` in the deployed env.
- Rotate `AUTH_SECRET`, DB passwords, and S3 keys on a schedule. `AUTH_SECRET` rotation
  invalidates existing sessions — expected.
- (TODO, see `TODO.md`) wire the real secret-store resolver behind the `databaseUrlSecretRef`
  seam for dedicated tenants.

---

## 8. Provider-agnostic rules (keep migration cheap)

1. **12-factor config** — everything via env vars, no hardcoded hosts.
2. **No durable local disk** — all persisted files go to S3 (the container FS is ephemeral).
3. **Stay on portable primitives** — Postgres, Redis, the S3 *API*. Don't couple to a provider's
   proprietary queue/cron/blob service; jobs are BullMQ, storage is the S3 SDK against
   `S3_ENDPOINT`.
4. **One Dockerfile per process = the deploy unit.** The same image must run everywhere.
5. Keep the email + secrets adapters behind their ports (`apps/api/src/jobs/ports.ts`) — swap the
   implementation, never the callers.

---

## 9. Pre-deploy checklist

- [ ] `pnpm -r typecheck` + `pnpm test` green on the release SHA (CI).
- [ ] Images built from the release SHA and pushed (`api`, `worker`, `web`, same tag).
- [ ] All **required** env vars present in the target environment (§3).
- [ ] Three DB roles exist; `DATABASE_APP_URL` points at the **RLS-forced** role.
- [ ] Redis + S3 reachable from the private network; bucket exists.
- [ ] Migration step ran successfully (§5) **before** app rollout.
- [ ] `/readyz` returns 200 on api; web serves; worker log shows it consuming the queue.
- [ ] Rollback plan: previous image tag known and re-deployable.

---

## 10. Rollback

- **App:** redeploy the previous image tag (images are immutable + tagged by SHA).
- **Migrations:** forward-only — there is no automatic down-migration. A bad migration is fixed
  by a new forward migration. This is *why* expand/contract (§5) matters: the previous app
  version must keep working against the new schema so an app rollback is always safe.

---

## Appendix — running the full stack locally with Docker (optional)

`docker compose up -d` already runs Postgres/Redis/MinIO for local dev; the app itself runs via
`pnpm dev` (or PM2, see `ecosystem.config.cjs`). The Dockerfiles here are for *deployment*, but
you can build and run them locally against the compose datastores to rehearse a release.
