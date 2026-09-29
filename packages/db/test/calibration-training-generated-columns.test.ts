import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePools, migratorPool, withTenant } from "../src/client.js";
import { nextDueDate } from "@kaenal/core";

/**
 * Generated-column integration tests (Sprint 05 Slice 2; §3.1 item 13, B1;
 * DoD "an integration test against real Postgres 16 asserts the
 * next_due/expires_at generated columns compute correctly" + "a test proves
 * the SQL-side ... and the packages/core pure-function version ... agree at
 * every boundary condition").
 *
 * `instruments.next_due` and `training_records.expires_at` are both
 * GENERATED ALWAYS AS columns driven by
 * `(base_date + make_interval(months => n))::date` — this is DB-side
 * generated-column arithmetic, which cannot be unit-tested in isolation from
 * a real Postgres engine (a mocked driver would just assert its own mock).
 * These tests insert real rows and read the computed column back, comparing
 * it against `packages/core/calibration.ts`'s `nextDueDate` — the same
 * month-end-clamping math applies to both `next_due` (from
 * `last_calibrated` + `interval_months`) and `expires_at` (from
 * `completed_at` + `valid_months`), so one core function is the correctness
 * oracle for both generated columns.
 */

const TENANT = "019f0000-0000-7000-8000-0000000000e0";
const USER_EMAIL = "gencol-test@fixture.test";

async function reset(): Promise<void> {
  const client = await migratorPool.connect();
  try {
    await client.query(
      `TRUNCATE TABLE instruments, calibration_events, competencies, training_records,
                      plants, memberships, control.users CASCADE`,
    );
  } finally {
    client.release();
  }
}

let userId: string;

beforeAll(async () => {
  await reset();

  const client = await migratorPool.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO control.users (email, name) VALUES ($1, 'Gencol Fixture') RETURNING id`,
      [USER_EMAIL],
    );
    userId = rows[0]!.id;
    await client.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active')`,
      [TENANT, userId],
    );
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await reset();
  await closePools();
});

/** Inserts a minimal instrument and returns its computed `next_due` (or null). */
async function insertInstrumentNextDue(
  lastCalibrated: string | null,
  intervalMonths: number,
): Promise<string | null> {
  return withTenant(TENANT, null, async (tx) => {
    const plant = await tx.query<{ id: string }>(
      `INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'Gencol Plant', $2) RETURNING id`,
      [TENANT, `GC-${Math.random().toString(36).slice(2, 8)}`],
    );
    const plantId = plant.rows[0]!.id;
    const { rows } = await tx.query<{ next_due: string | null }>(
      `INSERT INTO instruments (tenant_id, code, name, type, plant_id, method, tolerance,
                                 interval_months, last_calibrated, owner)
       VALUES ($1, $2, 'Gencol Instrument', 'caliper', $3, 'Internal', '±0.01mm', $4, $5, $6)
       RETURNING next_due::text`,
      [TENANT, `CAL-GC-${Math.random().toString(36).slice(2, 8)}`, plantId, intervalMonths, lastCalibrated, userId],
    );
    return rows[0]!.next_due;
  });
}

/** Inserts a minimal training record and returns its computed `expires_at` (or null). */
async function insertTrainingRecordExpiresAt(
  completedAt: string,
  validMonths: number | null,
): Promise<string | null> {
  return withTenant(TENANT, null, async (tx) => {
    const competency = await tx.query<{ id: string }>(
      `INSERT INTO competencies (tenant_id, code, name) VALUES ($1, $2, 'Gencol Competency') RETURNING id`,
      [TENANT, `gencol-${Math.random().toString(36).slice(2, 8)}`],
    );
    const competencyId = competency.rows[0]!.id;
    const { rows } = await tx.query<{ expires_at: string | null }>(
      `INSERT INTO training_records (tenant_id, member_id, competency_id, completed_at, valid_months)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING expires_at::text`,
      [TENANT, userId, competencyId, completedAt, validMonths],
    );
    return rows[0]!.expires_at;
  });
}

describe("instruments.next_due — GENERATED column agrees with packages/core's nextDueDate", () => {
  // The exact worked examples §3.1 item 13 / C1 AC1 name, confirmed against a
  // real Postgres 16 instance (not merely asserted).
  const cases: readonly [string, number][] = [
    ["2026-01-31", 1], // not a leap year -> clamps to Feb 28
    ["2028-01-31", 1], // 2028 IS a leap year -> clamps to Feb 29
    ["2026-12-31", 1], // 31 exists in January -> no clamp, rolls the year
    ["2026-01-31", 2], // 31 exists in March -> no clamp
    ["2026-05-31", 1], // 31 doesn't exist in June -> clamps to 30
  ];

  it.each(cases)("last_calibrated=%s, interval_months=%i", async (lastCalibrated, intervalMonths) => {
    const sqlResult = await insertInstrumentNextDue(lastCalibrated, intervalMonths);
    const coreResult = nextDueDate(lastCalibrated, intervalMonths);
    expect(sqlResult, "SQL generated column must agree with packages/core's nextDueDate").toBe(coreResult);
  });

  it("2026-01-31 + 1 month = 2026-02-28 exactly (the DoD's own named worked example)", async () => {
    await expect(insertInstrumentNextDue("2026-01-31", 1)).resolves.toBe("2026-02-28");
  });

  it("2028-01-31 + 1 month = 2028-02-29 exactly (the DoD's own named leap-year worked example)", async () => {
    await expect(insertInstrumentNextDue("2028-01-31", 1)).resolves.toBe("2028-02-29");
  });

  it("is NULL when last_calibrated is NULL (a never-calibrated instrument, C6)", async () => {
    await expect(insertInstrumentNextDue(null, 6)).resolves.toBeNull();
  });
});

describe("training_records.expires_at — GENERATED column agrees with the same make_interval math", () => {
  // expires_at uses the identical (base_date + make_interval(months => n))::date
  // shape as next_due (§3.1 item 13), so nextDueDate is equally the oracle here.
  const cases: readonly [string, number][] = [
    ["2026-01-31", 1],
    ["2028-01-31", 1],
    ["2026-12-31", 12],
    ["2026-05-31", 1],
  ];

  it.each(cases)("completed_at=%s, valid_months=%i", async (completedAt, validMonths) => {
    const sqlResult = await insertTrainingRecordExpiresAt(completedAt, validMonths);
    const coreResult = nextDueDate(completedAt, validMonths);
    expect(sqlResult, "SQL generated column must agree with packages/core's month-end math").toBe(coreResult);
  });

  it("is NULL when valid_months is NULL (a competency that never expires)", async () => {
    await expect(insertTrainingRecordExpiresAt("2026-01-31", null)).resolves.toBeNull();
  });
});
