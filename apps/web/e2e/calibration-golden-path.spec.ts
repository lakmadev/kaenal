import { expect, test } from "@playwright/test";

/**
 * Sprint 05 Slice 5 golden path: create an instrument → record a passing
 * calibration → verify the due date advances → record a failing calibration
 * → verify the distinct "Failed — overdue" banner → raise an NCR from that
 * fail event → verify it's one-time-blocked → retire the instrument → verify
 * editing/new-events are blocked.
 *
 * Requires the seeded demo tenant (`pnpm --filter @kaenal/api exec tsx
 * scripts/seed-demo.ts`): workspace `acme`, `demo@acme.test`.
 */

const WORKSPACE = process.env["E2E_WORKSPACE"] ?? "acme";
const EMAIL = process.env["E2E_EMAIL"] ?? "demo@acme.test";
const PASSWORD = process.env["E2E_PASSWORD"] ?? "demo-password-1234";

test("calibration: add instrument -> record pass -> record fail -> raise NCR -> retire", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Workspace").fill(WORKSPACE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/calibration");
  await expect(page.getByRole("heading", { name: "Calibration management" })).toBeVisible({ timeout: 20_000 });

  // --- Add instrument -------------------------------------------------------
  const uniqueName = `E2E Test Gauge ${Date.now()}`;
  await page.getByRole("button", { name: "Add instrument" }).first().click();
  await page.getByPlaceholder("e.g. Mitutoyo CMM Crysta-Apex S 776").fill(uniqueName);
  await page.getByLabel("Plant *").selectOption({ index: 1 });
  await page.getByPlaceholder("e.g. Internal — ISO 10360, or External — NABL accredited").fill("Internal — test method");
  await page.getByPlaceholder("e.g. ±1.7μm").fill("±1.0μm");
  await page.getByRole("button", { name: "Create instrument" }).click();

  // Lands on the new instrument's detail card (?id= deep link). Assertions
  // below scope to the detail card (there can be other test-data instruments
  // in the register sharing chip text like "Unscheduled"/"Failed — overdue").
  await expect(page).toHaveURL(/\/calibration\?id=[0-9a-f-]{36}/, { timeout: 20_000 });
  const detail = page.getByTestId("instrument-detail-card");
  await expect(detail.getByText(uniqueName)).toBeVisible();
  await expect(detail.getByText("Unscheduled")).toBeVisible();

  // --- Record a passing calibration -----------------------------------------
  await detail.getByRole("button", { name: /Record calibration/ }).click();
  await page.getByPlaceholder("e.g. A2LA Cal Labs, or a member name").fill("E2E Cal Labs");
  await page.getByRole("button", { name: "✓ Record calibration" }).click();
  await expect(detail.getByText("Pass — as found")).toBeVisible({ timeout: 20_000 });
  // Next due is now computed (no longer "Unscheduled").
  await expect(detail.getByText("Unscheduled")).toHaveCount(0);

  // --- Record a failing calibration ------------------------------------------
  await detail.getByRole("button", { name: /Record calibration/ }).click();
  await page.getByRole("tab", { name: "Fail" }).click();
  await page.getByPlaceholder("e.g. A2LA Cal Labs, or a member name").fill("E2E Cal Labs");
  await page.getByRole("button", { name: "✓ Record calibration" }).click();

  // The distinct solid "Failed — overdue" banner (detail card) and register
  // chip (B3 override) both appear.
  await expect(detail.getByText(/Failed its last calibration/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Failed — overdue").first()).toBeVisible();

  // --- Raise an NCR from the fail event ---------------------------------------
  // A short pause here keeps this fast, mutation-heavy sequence under the
  // per-user request cap (03 §9, `USER_LIMIT` = 60/min) — a real caller
  // clicking through the UI at human speed never approaches it; only a
  // scripted test issuing this many list/detail/history refetches in a few
  // seconds does.
  await page.waitForTimeout(2000);
  await detail.getByRole("button", { name: "Raise NCR" }).first().click();
  await page.getByRole("button", { name: "Raise NCR" }).last().click();
  await expect(detail.getByText(/View NCR/)).toBeVisible({ timeout: 20_000 });
  // One-time-blocked: no "Raise NCR" button remains for that now-linked event.
  await expect(detail.getByRole("button", { name: "Raise NCR" })).toHaveCount(0);

  // --- Retire the instrument ---------------------------------------------------
  await page.waitForTimeout(2000);
  await detail.getByRole("button", { name: "Instrument options" }).click();
  await page.getByText("Retire instrument").click();
  await page.getByRole("button", { name: "Retire instrument" }).click();
  await expect(detail.getByText("Retired").first()).toBeVisible({ timeout: 20_000 });
  // Editing/new-events controls are gone for a retired instrument.
  await expect(detail.getByRole("button", { name: /Record calibration/ })).toHaveCount(0);
});
