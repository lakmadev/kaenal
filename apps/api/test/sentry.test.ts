import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { captureServerError, initSentry, isSentryEnabled } from "../src/observability/sentry.js";
import type { Env } from "../src/env.js";

/**
 * Sentry wiring is off-by-default and safe. Without a DSN nothing initialises and
 * every capture is a no-op, so dev/test/local runs are unaffected.
 */
describe("observability/sentry", () => {
  it("stays disabled and no-ops when no DSN is configured", () => {
    initSentry({ SENTRY_DSN: undefined, NODE_ENV: "test", SENTRY_TRACES_SAMPLE_RATE: 0.1 } as Env);
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureServerError(new Error("x"), { requestId: "r" })).not.toThrow();
  });
});
