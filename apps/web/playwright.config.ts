import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

/**
 * End-to-end tests (previously unwired — CLAUDE.md). Drives the real web app in a
 * browser against a running dev server (which proxies `/api/*` to the API, so the
 * API + Postgres/Redis must also be up). Locally it reuses an already-running
 * `pnpm --filter @kaenal/web dev`; full-stack CI wiring (starting API + web +
 * seeding a fixture tenant) is a follow-up — see e2e/README.
 */

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

const config: PlaywrightTestConfig = {
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
};

// Reuse a running dev server; skip spawning when E2E_NO_SERVER is set (CI that
// manages the full stack itself). Set conditionally so the key is absent, not
// `undefined`, under exactOptionalPropertyTypes.
if (!process.env["E2E_NO_SERVER"]) {
  config.webServer = {
    command: "pnpm --filter @kaenal/web dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  };
}

export default defineConfig(config);
