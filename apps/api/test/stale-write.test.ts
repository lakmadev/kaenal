import { describe, expect, it } from "vitest";
import { StaleWriteDetails } from "@kaenal/types";
import { parseStaleWrite } from "@kaenal/core";
import { buildStaleDetails } from "../src/stale-write.js";

describe("buildStaleDetails", () => {
  it("emits expected/actual, ISO updatedAt and the resolved actor", () => {
    const d = buildStaleDetails(
      { updated_at: new Date("2026-03-01T10:00:00Z"), updated_by: "u1" },
      { id: "u1", name: "Ada" },
      { expected: 1, actual: 3 },
    );
    expect(d).toEqual({ expected: 1, actual: 3, updatedAt: "2026-03-01T10:00:00.000Z", updatedBy: { id: "u1", name: "Ada" } });
    expect(StaleWriteDetails.safeParse(d).success).toBe(true);
  });

  it("is null-safe: missing row or an actor outside the tenant resolves to null", () => {
    expect(buildStaleDetails(undefined, undefined, {})).toEqual({ updatedAt: null, updatedBy: null });
    const d = buildStaleDetails({ updated_at: "2026-03-01T10:00:00Z", updated_by: "foreign" }, undefined, { expected: 2 });
    expect(d).toEqual({ expected: 2, updatedAt: "2026-03-01T10:00:00.000Z", updatedBy: null });
  });

  it("round-trips through the client parser (envelope stays backward compatible)", () => {
    const d = buildStaleDetails({ updated_at: "2026-03-01T10:00:00Z", updated_by: "u1" }, { id: "u1", name: "Ada" }, { expected: 1, actual: 2 });
    const info = parseStaleWrite(409, { error: { code: "STALE_WRITE", message: "m", details: d } });
    expect(info).toMatchObject({ expected: 1, actual: 2, updatedBy: "u1", updatedByName: "Ada" });
  });
});
