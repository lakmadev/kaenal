#!/usr/bin/env bash
# One-shot local dev bring-up: run this AFTER `docker compose up -d`.
# Waits for Postgres/Redis to report healthy, applies migrations,
# provisions + seeds the `acme` demo tenant, then runs the API and web
# dev servers together until you Ctrl+C (both are stopped on exit).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Waiting for postgres + redis to be healthy..."
for svc in postgres redis; do
  until [ "$(docker compose ps -q "$svc" | xargs -r docker inspect -f '{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ]; do
    sleep 1
  done
done
echo "==> postgres + redis healthy."

echo "==> Applying migrations..."
pnpm db:migrate

echo "==> Provisioning 'acme' tenant (idempotent)..."
pnpm provision-tenant --slug acme --name "Acme" --model shared

echo "==> Seeding demo data (demo@acme.test / demo-password-1234)..."
pnpm --filter @kaenal/api exec tsx scripts/seed-demo.ts

echo "==> Starting API (:3001) and web (:3000). Ctrl+C to stop both."
trap 'kill 0' EXIT
pnpm --filter @kaenal/api dev &
pnpm --filter @kaenal/web dev &
wait
