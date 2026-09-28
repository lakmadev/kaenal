import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { computePredictionsForTenant } from "../src/jobs/processors/predict-risk.js";

/**
 * Predictive risk job (Sprint 03 Part B §3B — v1 trend + seasonal-naive
 * baseline). Runs `computePredictionsForTenant` directly against real
 * Postgres (mirrors `jobs.test.ts`'s SLA pattern): a rising 6-month NCR
 * history scores a line and a supplier (via its SCARs — `ncrs` itself carries
 * no `supplier_id`), a thin history gets no row (P1's "not enough history"
 * gate), a re-run upserts rather than duplicating, and an in-flight PPAP
 * submission's `ai_prediction` gets written (P6).
 */

const ACME = "acme";
let control: pg.Pool;
let acmeId = "";
let plantId = "";
let scoredAreaId = "";
let thinAreaId = "";
let scoredSupplierId = "";
let ppapId = "";

// Fixed "now" so month-bucket math is deterministic across runs.
const NOW = new Date(Date.UTC(2026, 8, 28)); // 2026-09-28

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

/** created_at for the i-th trailing month (0 = 5 months ago, 5 = current month). */
function monthDate(i: number): Date {
  return new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - (5 - i), 15));
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);

  await withTenant(acmeId, null, async (tx) => {
    const { rows: p } = await tx.query<{ id: string }>(
      `INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'PREDICTTEST Plant', $2) RETURNING id`,
      [acmeId, `PT-${randomUUID().slice(0, 8)}`],
    );
    plantId = p[0]!.id;

    const { rows: a1 } = await tx.query<{ id: string }>(
      `INSERT INTO areas (tenant_id, plant_id, name) VALUES ($1, $2, 'PREDICTTEST Rising Line') RETURNING id`,
      [acmeId, plantId],
    );
    scoredAreaId = a1[0]!.id;

    const { rows: a2 } = await tx.query<{ id: string }>(
      `INSERT INTO areas (tenant_id, plant_id, name) VALUES ($1, $2, 'PREDICTTEST Thin Line') RETURNING id`,
      [acmeId, plantId],
    );
    thinAreaId = a2[0]!.id;

    const { rows: s } = await tx.query<{ id: string }>(
      `INSERT INTO suppliers (tenant_id, name, code, status) VALUES ($1, 'PREDICTTEST Supplier', $2, 'active') RETURNING id`,
      [acmeId, `PT-SUP-${randomUUID().slice(0, 8)}`],
    );
    scoredSupplierId = s[0]!.id;

    // Rising history [1,2,2,3,4,4] for the line, one NCR per count per month.
    const counts = [1, 2, 2, 3, 4, 4];
    for (let m = 0; m < 6; m++) {
      for (let n = 0; n < counts[m]!; n++) {
        await tx.query(
          `INSERT INTO ncrs (tenant_id, code, title, source, priority, status, area_id, created_at, updated_at)
           VALUES ($1, $2, 'PREDICTTEST rising', 'manual', 'minor', 'open', $3, $4, $4)`,
          [acmeId, `PT-NCR-${randomUUID().slice(0, 8)}`, scoredAreaId, monthDate(m)],
        );
      }
    }

    // Thin history: only 2 of the 6 months have any NCR — below the minimum-
    // history gate (needs ≥4 of 6).
    for (const m of [4, 5]) {
      await tx.query(
        `INSERT INTO ncrs (tenant_id, code, title, source, priority, status, area_id, created_at, updated_at)
         VALUES ($1, $2, 'PREDICTTEST thin', 'manual', 'minor', 'open', $3, $4, $4)`,
        [acmeId, `PT-NCR-${randomUUID().slice(0, 8)}`, thinAreaId, monthDate(m)],
      );
    }

    // Supplier history, reachable only via a SCAR per NCR (ncrs has no
    // supplier_id column) — same rising shape as the line.
    for (let m = 0; m < 6; m++) {
      for (let n = 0; n < counts[m]!; n++) {
        const { rows: ncr } = await tx.query<{ id: string }>(
          `INSERT INTO ncrs (tenant_id, code, title, source, priority, status, created_at, updated_at)
           VALUES ($1, $2, 'PREDICTTEST supplier', 'manual', 'minor', 'open', $3, $3) RETURNING id`,
          [acmeId, `PT-NCR-${randomUUID().slice(0, 8)}`, monthDate(m)],
        );
        await tx.query(
          `INSERT INTO scars (tenant_id, code, supplier_id, ncr_id, status)
           VALUES ($1, $2, $3, $4, 'open')`,
          [acmeId, `PT-SCAR-${randomUUID().slice(0, 8)}`, scoredSupplierId, ncr[0]!.id],
        );
      }
    }

    // An in-flight PPAP submission, early-stage and behind pace (P6).
    const { rows: ppap } = await tx.query<{ id: string }>(
      `INSERT INTO ppap_submissions (tenant_id, supplier_id, part_number, level, status, submitted_date, due_date, elements)
       VALUES ($1, $2, 'PT-PN-1', 3, 'in_review', $3, $4, '[]'::jsonb) RETURNING id`,
      [
        acmeId,
        scoredSupplierId,
        new Date(NOW.getTime() - 20 * 86_400_000).toISOString().slice(0, 10),
        new Date(NOW.getTime() + 5 * 86_400_000).toISOString().slice(0, 10),
      ],
    );
    ppapId = ppap[0]!.id;
  });
});

afterAll(async () => {
  await control.query("DELETE FROM risk_predictions WHERE subject_id = ANY($1::uuid[])", [
    [scoredAreaId, thinAreaId, scoredSupplierId],
  ]);
  await control.query("DELETE FROM ppap_submissions WHERE id = $1", [ppapId]);
  await control.query("DELETE FROM scars WHERE code LIKE 'PT-SCAR-%'");
  await control.query("DELETE FROM ncrs WHERE title LIKE 'PREDICTTEST%'");
  await control.query("DELETE FROM suppliers WHERE id = $1", [scoredSupplierId]);
  await control.query("DELETE FROM areas WHERE id = ANY($1::uuid[])", [[scoredAreaId, thinAreaId]]);
  await control.query("DELETE FROM plants WHERE id = $1", [plantId]);
  await control.end();
});

describe("computePredictionsForTenant", () => {
  it("scores a line with enough history into 3 horizon rows, audited", async () => {
    const result = await computePredictionsForTenant(acmeId, NOW, {});
    expect(result.linesScored).toBeGreaterThanOrEqual(1);
    expect(result.suppliersScored).toBeGreaterThanOrEqual(1);

    const { rows } = await control.query<{
      horizon: string;
      predicted_value: string;
      confidence: number;
      history: string[];
      model_version: string;
    }>(
      `SELECT horizon, predicted_value, confidence, history, model_version
         FROM risk_predictions WHERE subject_kind = 'line' AND subject_id = $1 ORDER BY horizon`,
      [scoredAreaId],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.model_version === "nc-forecast-v1-baseline")).toBe(true);
    expect(rows[0]?.history.map(Number)).toEqual([1, 2, 2, 3, 4, 4]);
    // Rising trend → next month's forecast is above the trailing average.
    expect(Number(rows.find((r) => r.horizon === "2026-10")?.predicted_value)).toBeGreaterThan(2.6);

    const audit = await control.query(
      "SELECT 1 FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'risk_prediction' AND entity_id = $2",
      [acmeId, scoredAreaId],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(3);
  });

  it("writes no row for a subject below the minimum-history gate", async () => {
    await computePredictionsForTenant(acmeId, NOW, {});
    const { rows } = await control.query("SELECT 1 FROM risk_predictions WHERE subject_id = $1", [thinAreaId]);
    expect(rows).toHaveLength(0);
  });

  it("scores a supplier via its SCARs (ncrs carries no supplier_id)", async () => {
    await computePredictionsForTenant(acmeId, NOW, {});
    const { rows } = await control.query(
      "SELECT 1 FROM risk_predictions WHERE subject_kind = 'supplier' AND subject_id = $1",
      [scoredSupplierId],
    );
    expect(rows).toHaveLength(3);
  });

  it("upserts on re-run rather than accumulating duplicate rows", async () => {
    await computePredictionsForTenant(acmeId, NOW, {});
    await computePredictionsForTenant(acmeId, NOW, {});
    const { rows } = await control.query("SELECT 1 FROM risk_predictions WHERE subject_id = $1", [scoredAreaId]);
    expect(rows).toHaveLength(3);
  });

  it("writes a real ai_prediction for an in-flight PPAP submission behind pace (P6)", async () => {
    const result = await computePredictionsForTenant(acmeId, NOW, {});
    expect(result.ppapScored).toBeGreaterThanOrEqual(1);

    const { rows } = await control.query<{ ai_prediction: { willMissDeadline?: boolean } }>(
      "SELECT ai_prediction FROM ppap_submissions WHERE id = $1",
      [ppapId],
    );
    const prediction = rows[0]?.ai_prediction;
    expect(prediction).toBeDefined();
    expect(Object.keys(prediction ?? {}).length).toBeGreaterThan(0);
    expect(prediction?.willMissDeadline).toBe(true); // 0% complete, 5 days left

    const audit = await control.query(
      "SELECT 1 FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'ppap_submission' AND entity_id = $2 AND action = 'updated'",
      [acmeId, ppapId],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });
});
