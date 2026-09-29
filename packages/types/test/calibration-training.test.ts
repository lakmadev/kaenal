import { describe, expect, it } from "vitest";
import {
  CreateCalibrationEventBody,
  CreateTrainingRecordBody,
  ReorderCompetenciesBody,
} from "../src/dto.js";

/**
 * Sprint 05 Slice 3 — Zod-level correctness fixes named explicitly by the
 * sprint file's amendment rounds:
 *
 * - `ReorderCompetenciesBody`'s duplicate-id rejection (the architecture
 *   review's own correction: `ids.length === count && new Set(ids).size ===
 *   ids.length`, NOT a naive set-equality check that lets a duplicate
 *   silently stand in for a missing id — this file tests the schema-level
 *   half of that check, rejecting any duplicate within the submitted array
 *   itself; the DB-count half needs the current row count and lives in the
 *   service, next slice).
 * - Future-date rejection on `performedAt` (C2 AC7) / `completedAt` (T2 AC4).
 */

const validEvent = {
  performedAt: "2020-01-01",
  result: "pass" as const,
  performedBy: "A2LA Cal Labs",
  notes: "",
  lockVersion: 0,
};

const validRecord = {
  memberIds: ["11111111-1111-4111-8111-111111111111"],
  competencyId: "22222222-2222-4222-8222-222222222222",
  completedAt: "2020-01-01",
};

describe("ReorderCompetenciesBody — duplicate-id rejection", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const c = "33333333-3333-4333-8333-333333333333";

  it("accepts a distinct, ordered id array", () => {
    expect(ReorderCompetenciesBody.safeParse({ ids: [a, b, c] }).success).toBe(true);
  });

  it("rejects a body with a repeated id, even when the array length matches", () => {
    // [a, a, c] is the exact shape a naive "same length, same Set" check
    // would wrongly wave through if it compared set equality without also
    // checking the array's own length against the set's size.
    const result = ReorderCompetenciesBody.safeParse({ ids: [a, a, c] });
    expect(result.success).toBe(false);
  });

  it("rejects a body where the last id is duplicated in place of a distinct one", () => {
    const result = ReorderCompetenciesBody.safeParse({ ids: [a, b, b] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty id array", () => {
    expect(ReorderCompetenciesBody.safeParse({ ids: [] }).success).toBe(false);
  });
});

describe("CreateCalibrationEventBody — performedAt future-date rejection (C2 AC7)", () => {
  it("accepts a past performedAt", () => {
    expect(CreateCalibrationEventBody.safeParse(validEvent).success).toBe(true);
  });

  it("accepts today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(CreateCalibrationEventBody.safeParse({ ...validEvent, performedAt: today }).success).toBe(true);
  });

  it("rejects a clearly future performedAt", () => {
    const result = CreateCalibrationEventBody.safeParse({ ...validEvent, performedAt: "2999-01-01" });
    expect(result.success).toBe(false);
  });
});

describe("CreateTrainingRecordBody — completedAt future-date rejection (T2 AC4)", () => {
  it("accepts a past completedAt", () => {
    expect(CreateTrainingRecordBody.safeParse(validRecord).success).toBe(true);
  });

  it("accepts today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(CreateTrainingRecordBody.safeParse({ ...validRecord, completedAt: today }).success).toBe(true);
  });

  it("rejects a clearly future completedAt", () => {
    const result = CreateTrainingRecordBody.safeParse({ ...validRecord, completedAt: "2999-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty memberIds array", () => {
    expect(CreateTrainingRecordBody.safeParse({ ...validRecord, memberIds: [] }).success).toBe(false);
  });
});
