import { describe, expect, it } from "vitest";
import { competencyCellState, TRAINING_WARN_WINDOW_DAYS } from "../src/competency.js";

/**
 * Training matrix cell-state math (Sprint 05 T1 AC2; §3.1 items 6/7).
 */

describe("competencyCellState — all five outcomes", () => {
  const today = "2026-06-15";

  it("no record + mandatory -> gap", () => {
    expect(
      competencyCellState({ hasRecord: false, mandatory: true, expiresAt: null, today }),
    ).toBe("gap");
  });

  it("no record + not mandatory -> na", () => {
    expect(
      competencyCellState({ hasRecord: false, mandatory: false, expiresAt: null, today }),
    ).toBe("na");
  });

  it("record exists + expiresAt in the past -> overdue", () => {
    expect(
      competencyCellState({
        hasRecord: true,
        mandatory: true,
        expiresAt: "2026-06-14",
        today,
      }),
    ).toBe("overdue");
  });

  it("record exists + expiresAt within the warn window -> warn", () => {
    expect(
      competencyCellState({
        hasRecord: true,
        mandatory: true,
        expiresAt: "2026-07-15",
        today,
      }),
    ).toBe("warn");
  });

  it("record exists + expiresAt is null (never expires) -> ok", () => {
    expect(
      competencyCellState({ hasRecord: true, mandatory: true, expiresAt: null, today }),
    ).toBe("ok");
  });

  it("record exists + expiresAt beyond the warn window -> ok", () => {
    expect(
      competencyCellState({
        hasRecord: true,
        mandatory: false,
        expiresAt: "2026-07-16",
        today,
      }),
    ).toBe("ok");
  });
});

describe("competencyCellState — the warn-window boundary", () => {
  const today = "2026-06-15";

  it(`expiresAt exactly ${TRAINING_WARN_WINDOW_DAYS} days out is warn, not ok`, () => {
    expect(
      competencyCellState({ hasRecord: true, mandatory: true, expiresAt: "2026-07-15", today }),
    ).toBe("warn");
  });

  it(`expiresAt ${TRAINING_WARN_WINDOW_DAYS + 1} days out is ok`, () => {
    expect(
      competencyCellState({ hasRecord: true, mandatory: true, expiresAt: "2026-07-16", today }),
    ).toBe("ok");
  });

  it("expiresAt === today reads warn, not overdue — matches instrumentDueStatus's due-day rule (B4(b))", () => {
    expect(
      competencyCellState({ hasRecord: true, mandatory: true, expiresAt: today, today }),
    ).toBe("warn");
  });

  it("expiresAt one day in the past reads overdue", () => {
    expect(
      competencyCellState({ hasRecord: true, mandatory: true, expiresAt: "2026-06-14", today }),
    ).toBe("overdue");
  });

  it("mandatory has no bearing once a record exists (only the no-record branch reads it)", () => {
    const withoutMandatory = competencyCellState({
      hasRecord: true,
      mandatory: false,
      expiresAt: "2026-06-14",
      today,
    });
    const withMandatory = competencyCellState({
      hasRecord: true,
      mandatory: true,
      expiresAt: "2026-06-14",
      today,
    });
    expect(withoutMandatory).toBe(withMandatory);
    expect(withoutMandatory).toBe("overdue");
  });
});
