import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These are integration tests against ONE real Postgres database, and
    // several of them TRUNCATE shared tables to get a clean slate. Run test
    // files serially so they cannot wipe each other's fixtures mid-run.
    //
    // TRUNCATE is unavoidable here: audit_events is append-only, so DELETE is
    // denied to the app role and blocked by a trigger — the only way to reset
    // it is table-wide as the owner. Serial execution is the cost of testing
    // the real isolation guarantees rather than a mock.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
