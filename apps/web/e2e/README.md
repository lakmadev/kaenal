# End-to-end tests (Playwright)

Browser tests that drive the real web app through the full stack (Next → dev
proxy → API → RLS → Postgres) — the coverage unit/integration tests can't give.

## Run locally

Bring the stack up, then run the tests:

```bash
docker compose up -d                                        # postgres + redis + minio
pnpm --filter @kaenal/api exec tsx scripts/seed-demo.ts     # seed acme / demo@acme.test
pnpm --filter @kaenal/api dev                               # API on :3001
pnpm --filter @kaenal/web dev                               # web on :3000 (proxies /api)
pnpm e2e                                                    # runs Playwright
```

Playwright **reuses** an already-running web server on `:3000` (and the API must
be up on `:3001`). Override the target with `E2E_BASE_URL`, and the login with
`E2E_WORKSPACE` / `E2E_EMAIL` / `E2E_PASSWORD`.

## Specs

- `golden-path.spec.ts` — the flow that must never break: two-step sign-in →
  dashboard → NCR module → open a record.

## CI (follow-up)

`playwright.config.ts` starts a web dev server (`reuseExistingServer`), but a CI
job must ALSO stand up the API + Postgres/Redis and seed a fixture tenant before
the web server is useful. Wiring that full-stack job (compose up → migrate →
seed → start API → `E2E_NO_SERVER=1 pnpm e2e` with web started by the job) is the
next step; the specs and config are ready for it.
