import { initSentryFromProcessEnv } from "./sentry.js";

/**
 * Side-effect preload — imported FIRST in `main.ts`, before `AppModule` (and thus
 * before http/pg/ioredis load), so Sentry's OpenTelemetry auto-instrumentation
 * can wrap them. Reads only the Sentry keys straight from `process.env` (it runs
 * before the app's validated `loadEnv()`), and is a no-op without `SENTRY_DSN`.
 */
initSentryFromProcessEnv();
