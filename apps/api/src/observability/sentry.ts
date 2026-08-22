import * as Sentry from "@sentry/node";
import type { Env } from "../env.js";

/**
 * Sentry wiring (error tracking + OTel-based tracing).
 *
 * Everything here is a no-op unless `SENTRY_DSN` is set, so dev/test runs are
 * unaffected. @sentry/node v8+ is built on OpenTelemetry, so enabling this with a
 * traces sample rate also gives distributed tracing (HTTP / pg / ioredis spans),
 * provided init runs before those modules load — hence the `instrument.ts`
 * preload, imported first in `main.ts`.
 */

let enabled = false;

export function initSentry(env: Env): void {
  if (env.SENTRY_DSN === undefined) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Never attach request bodies / headers / user PII to events — this is a
    // multi-tenant QMS and error payloads must not carry tenant data (07 §1).
    sendDefaultPii: false,
  });
  enabled = true;
}

/**
 * Init from raw `process.env` — used by the `instrument.ts` preload, which runs
 * before the app's validated `loadEnv()` (and before `.env` is loaded in dev), so
 * it can't depend on the full config. Reads only the Sentry keys; a no-op unless
 * `SENTRY_DSN` is present (so dev/test, which have none, are unaffected).
 */
export function initSentryFromProcessEnv(): void {
  const dsn = process.env["SENTRY_DSN"];
  if (dsn === undefined || dsn === "") return;
  const rate = Number(process.env["SENTRY_TRACES_SAMPLE_RATE"] ?? "0.1");
  initSentry({
    SENTRY_DSN: dsn,
    SENTRY_ENVIRONMENT: process.env["SENTRY_ENVIRONMENT"],
    NODE_ENV: (process.env["NODE_ENV"] as Env["NODE_ENV"] | undefined) ?? "development",
    SENTRY_TRACES_SAMPLE_RATE: Number.isFinite(rate) ? rate : 0.1,
  } as Env);
}

export interface ErrorMeta {
  readonly requestId: string;
  readonly method?: string;
  readonly path?: string;
  readonly tenant?: string;
}

/**
 * Report an unexpected (5xx) server error, correlated by requestId + tenant.
 * No-op unless Sentry initialised. Only the error envelope filter calls this,
 * and only for 5xx — handled 4xx business errors are never captured.
 */
export function captureServerError(exception: unknown, meta: ErrorMeta): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag("request_id", meta.requestId);
    if (meta.tenant !== undefined) scope.setTag("tenant", meta.tenant);
    if (meta.method !== undefined) scope.setTag("http.method", meta.method);
    if (meta.path !== undefined) scope.setContext("request", { path: meta.path, method: meta.method });
    Sentry.captureException(exception);
  });
}

/** Flush buffered events on shutdown (best-effort). */
export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* shutting down — never throw */
  }
}

/** Test-only: whether init actually ran. */
export function isSentryEnabled(): boolean {
  return enabled;
}
