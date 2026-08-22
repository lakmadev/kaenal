import { expect, test } from "@playwright/test";

/**
 * The golden path — the flow that must never break: sign in (two-step workspace →
 * credentials), land on the dashboard, then open the NCR module and see a real
 * record. Proves the whole stack end to end (Next → proxy → API → RLS → Postgres)
 * in a browser, which unit/integration tests can't.
 *
 * Requires the seeded demo tenant (`pnpm --filter @kaenal/api exec tsx
 * scripts/seed-demo.ts`): workspace `acme`, `demo@acme.test`. Override via
 * E2E_WORKSPACE / E2E_EMAIL / E2E_PASSWORD.
 */

const WORKSPACE = process.env["E2E_WORKSPACE"] ?? "acme";
const EMAIL = process.env["E2E_EMAIL"] ?? "demo@acme.test";
const PASSWORD = process.env["E2E_PASSWORD"] ?? "demo-password-1234";

test("sign in → dashboard → NCRs → open an NCR", async ({ page }) => {
  await page.goto("/sign-in");

  // Step 1 — workspace.
  await page.getByLabel("Workspace").fill(WORKSPACE);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 — credentials.
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Lands authenticated on the dashboard.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  // The NCR module lists real records.
  await page.goto("/ncrs");
  await expect(page).toHaveURL(/\/ncrs/);
  const anNcr = page.getByText(/NCR-\d{4}-\d{4}/).first();
  await expect(anNcr).toBeVisible({ timeout: 20_000 });

  // Opening one reaches its detail route.
  await anNcr.click();
  await expect(page).toHaveURL(/\/ncrs\/[0-9a-f-]{36}/, { timeout: 20_000 });
});
