# TROUBLESHOOTING — dev server / reload failures

**Read this FIRST when a dev server won't start, won't hot-reload, or a request that
should work returns an error.** Most failures below cost a long root-cause hunt the first
time and are a 30-second lookup the second time. If you hit something new, add it here in
the same session.

## Fast triage (do these before deep-diving)

1. **Is it a reload or a crash?** `tsx watch` (API) and `next dev` (web) both keep the old
   server running when a *type* error appears — the browser still hits stale code. A
   *runtime throw at import time* kills the process. Check the actual terminal/preview logs:
   - API: `preview_logs` for the API server, or the `pnpm --filter @kaenal/api dev` terminal.
   - Web: `mcp__Claude_Browser__preview_logs` (serverId of the `web` preview).
2. **Neither app needs a build step for shared packages.** `@kaenal/types` (and the other
   `packages/*`) resolve from source (`packages/types/package.json` → `"main": "./src/index.ts"`).
   If types "aren't updating," it's almost never a stale build — it's a real type error or a
   `tsc` server that hasn't re-run. Run the typecheck directly:
   ```bash
   pnpm --filter @kaenal/api typecheck && pnpm --filter @kaenal/web typecheck
   ```
3. **API hot-reload is `tsx watch src/main.ts`** — it re-executes on save. A syntax/import
   error prints and the *previous* process may stay up. Don't trust "it still works in the
   browser"; read the logs for the compile error.

## Known failures — symptom → cause → fix

### Sign-in returns 401 with correct credentials (after DB/test churn)
- **Cause:** A stale httpOnly `kaenal_session` cookie in the browser jar points at a session
  row that no longer exists (commonly because a test run — e.g. `auth.test.ts` — deleted
  demo sessions). `@AllowAnonymous` routes (sign-in, accept-invite) still run the
  authenticator, which **throws** `UNAUTHENTICATED` ("Your session has expired") on an
  unresolvable token instead of falling through to anonymous.
- **Fix (already in place):** `apps/api/src/lifecycle.interceptor.ts` wraps
  `authenticator.authenticate` in try/catch and tolerates a stale session **only** on
  `allowAnonymous` routes. If this regresses, that try/catch is the thing to check.
- **Quick unblock while debugging:** clear the `kaenal_session` cookie for the tenant origin,
  or verify the credential out-of-band with curl (expect 201):
  ```bash
  curl -si -X POST http://localhost:3001/v1/auth/sign-in -H 'content-type: application/json' -H 'host: acme.localhost:3001' -d '{"email":"demo@acme.test","password":"<pw>"}' | head -1
  ```

### `pg` DeprecationWarning "called client.query() when already executing" / query hangs
- **Cause:** Two queries issued concurrently on the **same** `tx`/client — usually
  `Promise.all([tx.query(...), tx.query(...)])`. A single pg connection cannot multiplex.
- **Fix:** `await` the queries **sequentially**. (This bit us in `me.controller.ts`.) Only
  parallelize across *different* connections, never across one `tx`.

### Test teardown fails with FK violation on `DELETE FROM memberships`
- **Cause:** Assignment notifications carry a composite member FK
  `(tenant_id, actor_id) → memberships`. Deleting memberships before notifications violates it.
- **Fix:** In suite teardown, `DELETE FROM notifications ...` **before** `DELETE FROM memberships`.
  Applies to `ncr`, `inspections`, `eight-d`, `scar` tests.

### `auth.test.ts` shows "Failed Suites 1" but all tests pass (local only)
- **Cause:** Teardown sweeps `WHERE email LIKE '%@acme.test'`, which also deletes the local
  **demo** user that other rows (e.g. an NCR's `resolved_by`) still reference → FK error at
  teardown. Pre-existing and **local-only** (CI has no demo seed). NOT a regression.
- **Action:** Don't chase it. If it blocks demo sign-in afterward, re-seed the demo tenant.

### Flaky `@kaenal/api` scoped-transaction concurrency test (ECONNRESET)
- **Cause:** Known flake under the shared-Postgres serial test run. Not a real failure.
- **Action:** Re-run; don't debug. (See memory `flaky-scoped-transaction-test`.)

### Integration tests interfere with each other / RLS weirdness
- **Cause:** All suites share ONE Postgres, so `pnpm test` runs `--concurrency=1`. A suite
  that doesn't seed+clean its own fixtures corrupts the next.
- **Fix:** Each suite seeds and tears down its own rows. Never assume a clean DB.

### `read_console_messages` shows old errors that are already fixed
- **Cause:** The tool replays a stale buffer. (See memory `browser-console-stale-buffer`.)
- **Fix:** Reload the page and attach a fresh page-level listener, or trust `preview_logs`
  over the replayed console buffer for "is it broken *now*".

## When it's genuinely a new problem
Read the logs, reproduce with curl (API) so you separate server bugs from browser/cookie
state, fix the source, then **add the symptom→cause→fix here** so next time is a lookup.
