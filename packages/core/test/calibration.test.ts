import { describe, expect, it } from "vitest";
import {
  activeCalibrationThreshold,
  CALIBRATION_WARN_WINDOW_DAYS,
  instrumentDueStatus,
  nextDueDate,
} from "../src/calibration.js";

/**
 * Calibration due/overdue math (Sprint 05 C1/C2/C5; §3.1 items 1, 3, 13, 14, 15).
 *
 * `nextDueDate`'s month-end clamping must agree, at every boundary, with
 * Postgres's own `(last_calibrated + make_interval(months => interval_months))
 * ::date` generated column (C1 AC1) — a later slice adds a real integration
 * test against Postgres 16 asserting the SAME worked examples pinned here, so
 * the SQL-side generated column and this pure function can never silently
 * disagree at a boundary. This file's cases ARE the worked examples the
 * sprint file states Postgres produces.
 */

describe("nextDueDate — month-end clamping (§3.1 item 13)", () => {
  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    expect(nextDueDate("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    expect(nextDueDate("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("does not clamp when the target month has 31 days", () => {
    expect(nextDueDate("2026-12-31", 1)).toBe("2027-01-31");
  });

  it("carries the year forward across a multi-month interval", () => {
    expect(nextDueDate("2026-01-31", 12)).toBe("2027-01-31");
    expect(nextDueDate("2026-01-31", 13)).toBe("2027-02-28");
  });

  it("clamps Oct 31 + 4 months to Feb 28/29 depending on the landing year", () => {
    expect(nextDueDate("2026-10-31", 4)).toBe("2027-02-28");
    expect(nextDueDate("2027-10-31", 4)).toBe("2028-02-29");
  });

  it("does not clamp a day that exists in every month (e.g. the 15th)", () => {
    expect(nextDueDate("2026-01-15", 1)).toBe("2026-02-15");
  });

  it("rejects a non-positive or non-integer interval", () => {
    expect(() => nextDueDate("2026-01-31", 0)).toThrow(/positive integer/i);
    expect(() => nextDueDate("2026-01-31", -1)).toThrow(/positive integer/i);
    expect(() => nextDueDate("2026-01-31", 1.5)).toThrow(/positive integer/i);
  });
});

describe("instrumentDueStatus (§3.1 items 3/14 — the fail-always-overdue fix)", () => {
  const today = "2026-06-15";

  it("is unscheduled when never calibrated", () => {
    expect(instrumentDueStatus({ nextDue: null, lastResult: null, today })).toBe("unscheduled");
  });

  it("is overdue once next_due is strictly in the past", () => {
    expect(instrumentDueStatus({ nextDue: "2026-06-14", lastResult: "pass", today })).toBe(
      "overdue",
    );
  });

  it("reads warn on the due day itself, not overdue (B4(b))", () => {
    expect(instrumentDueStatus({ nextDue: today, lastResult: "pass", today })).toBe("warn");
  });

  it(`reads warn within the ${CALIBRATION_WARN_WINDOW_DAYS}-day window`, () => {
    expect(instrumentDueStatus({ nextDue: "2026-07-15", lastResult: "pass", today })).toBe("warn");
    expect(instrumentDueStatus({ nextDue: "2026-06-16", lastResult: "pass", today })).toBe("warn");
  });

  it("reads ok just beyond the warn window", () => {
    expect(instrumentDueStatus({ nextDue: "2026-07-16", lastResult: "pass", today })).toBe("ok");
  });

  it("a fail ALWAYS reads overdue, regardless of next_due being far in the future (B3)", () => {
    expect(
      instrumentDueStatus({ nextDue: "2027-06-15", lastResult: "fail", today }),
    ).toBe("overdue");
    expect(instrumentDueStatus({ nextDue: null, lastResult: "fail", today })).toBe("overdue");
  });

  it("adjusted/pass are treated identically for status purposes", () => {
    expect(instrumentDueStatus({ nextDue: "2026-06-14", lastResult: "adjusted", today })).toBe(
      "overdue",
    );
  });
});

describe("activeCalibrationThreshold (§3.1 item 15 — approach + overdue sides)", () => {
  const today = "2026-06-15";
  const dueIn = (days: number) => {
    const d = new Date(Date.UTC(2026, 5, 15 + days));
    return d.toISOString().slice(0, 10);
  };

  it("is null more than 30 days out", () => {
    expect(activeCalibrationThreshold({ nextDue: dueIn(31), today })).toBeNull();
    expect(activeCalibrationThreshold({ nextDue: dueIn(45), today })).toBeNull();
  });

  it("returns 30 for every day 8 through 30 out — smallest threshold crossed, not exact-day-only", () => {
    expect(activeCalibrationThreshold({ nextDue: dueIn(30), today })).toBe(30);
    expect(activeCalibrationThreshold({ nextDue: dueIn(15), today })).toBe(30);
    expect(activeCalibrationThreshold({ nextDue: dueIn(8), today })).toBe(30);
  });

  it("returns 7 for every day 1 through 7 out", () => {
    expect(activeCalibrationThreshold({ nextDue: dueIn(7), today })).toBe(7);
    expect(activeCalibrationThreshold({ nextDue: dueIn(4), today })).toBe(7);
    expect(activeCalibrationThreshold({ nextDue: dueIn(1), today })).toBe(7);
  });

  it("returns 0 on the due day itself", () => {
    expect(activeCalibrationThreshold({ nextDue: dueIn(0), today })).toBe(0);
  });

  it("returns 0 (never a negative -0) for days 1 through 6 overdue", () => {
    for (const daysOverdue of [1, 2, 3, 4, 5, 6]) {
      const result = activeCalibrationThreshold({ nextDue: dueIn(-daysOverdue), today });
      expect(result).toBe(0);
      expect(Object.is(result, -0)).toBe(false);
    }
  });

  it("returns -7 for days 7 through 13 overdue", () => {
    expect(activeCalibrationThreshold({ nextDue: dueIn(-7), today })).toBe(-7);
    expect(activeCalibrationThreshold({ nextDue: dueIn(-13), today })).toBe(-7);
  });

  it("returns -14 for days 14 through 20 overdue, uncapped beyond that", () => {
    expect(activeCalibrationThreshold({ nextDue: dueIn(-14), today })).toBe(-14);
    expect(activeCalibrationThreshold({ nextDue: dueIn(-20), today })).toBe(-14);
    expect(activeCalibrationThreshold({ nextDue: dueIn(-21), today })).toBe(-21);
    expect(activeCalibrationThreshold({ nextDue: dueIn(-70), today })).toBe(-70);
  });
});

/**
 * §4/§8's own required test: this pure-function logic and the eventual
 * SQL-side generated-column/threshold-query equivalent must agree at every
 * boundary condition. The real DB-side comparison needs a live Postgres 16
 * instance (the migration doesn't exist yet in this slice — that is a later
 * slice's integration test, per §3.1 item 13's own explicit split between
 * DB-generated-column arithmetic and packages/core pure functions). This
 * suite instead pins the exact worked examples the sprint file states
 * Postgres produces (see the `nextDueDate` describe block above), so a later
 * slice can extend it with `expect(nextDueDate(...)).toBe(sqlResult)`
 * assertions against a real database without re-deriving the cases.
 */
describe("SQL agreement placeholder (§4/§8 requirement, extended in a later slice)", () => {
  it("documents the exact worked examples the DB-side generated column must also produce", () => {
    const workedExamples: ReadonlyArray<readonly [string, number, string]> = [
      ["2026-01-31", 1, "2026-02-28"],
      ["2028-01-31", 1, "2028-02-29"],
    ];
    for (const [lastCalibrated, months, expected] of workedExamples) {
      expect(nextDueDate(lastCalibrated, months)).toBe(expected);
    }
  });
});
