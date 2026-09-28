import { describe, expect, it } from "vitest";
import {
  bandHalfWidth,
  computeForecast,
  confidenceFromFit,
  forecastReasoning,
  hasMinimumHistory,
  horizonLabel,
  olsFit,
  ppapRiskScore,
  riskLevel,
  trailingAverage,
  trendForecast,
} from "../src/forecast.js";

/**
 * v1 predictive-risk baseline (Sprint 03 Part B, §3B — user-approved
 * 2026-09-28). Pinned against a hand-computed reference series: a perfectly
 * linear trend [1,2,3,4,5,6] has a known-by-construction OLS fit (slope 1,
 * intercept 1, R²=1), so every downstream number (forecast, band, confidence,
 * risk level) can be checked by hand rather than just "doesn't throw".
 */

const LINEAR = [1, 2, 3, 4, 5, 6];
const FLAT = [3, 3, 3, 3, 3, 3];
const NOISY = [2, 5, 1, 6, 2, 5];

describe("olsFit", () => {
  it("fits a perfectly linear series exactly", () => {
    const fit = olsFit(LINEAR);
    expect(fit.slope).toBeCloseTo(1, 10);
    expect(fit.intercept).toBeCloseTo(1, 10);
    expect(fit.r2).toBeCloseTo(1, 10);
    expect(fit.residualStdDev).toBeCloseTo(0, 10);
  });

  it("fits a flat series with zero slope and r2 0 (no variance to explain)", () => {
    const fit = olsFit(FLAT);
    expect(fit.slope).toBeCloseTo(0, 10);
    expect(fit.intercept).toBeCloseTo(3, 10);
    expect(fit.r2).toBe(0);
  });

  it("does not throw on a degenerate (short) series", () => {
    expect(olsFit([5])).toEqual({ slope: 0, intercept: 5, r2: 0, residualStdDev: 0 });
    expect(olsFit([])).toEqual({ slope: 0, intercept: 0, r2: 0, residualStdDev: 0 });
  });
});

describe("trendForecast", () => {
  it("extrapolates the linear series to the next point (index 6 → value 7)", () => {
    expect(trendForecast(LINEAR, 1)).toBeCloseTo(7, 10);
    expect(trendForecast(LINEAR, 3)).toBeCloseTo(9, 10); // index 8
    expect(trendForecast(LINEAR, 6)).toBeCloseTo(12, 10); // index 11
  });

  it("never goes negative", () => {
    // A steep downward trend projected far enough would go negative without the floor.
    expect(trendForecast([6, 5, 4, 3, 2, 1], 10)).toBe(0);
  });
});

describe("bandHalfWidth", () => {
  it("is zero for a perfectly linear (zero-residual) series", () => {
    expect(bandHalfWidth(olsFit(LINEAR), 1)).toBeCloseTo(0, 10);
  });

  it("widens with distance (√periodsAhead scaling)", () => {
    const fit = olsFit(NOISY);
    const near = bandHalfWidth(fit, 1);
    const far = bandHalfWidth(fit, 6);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeCloseTo(near * Math.sqrt(6), 6);
  });
});

describe("confidenceFromFit", () => {
  it("is 100 for a perfect trend over a full 6-period history", () => {
    expect(confidenceFromFit(olsFit(LINEAR), 6)).toBe(100);
  });

  it("is 0 for a flat (r2=0) series", () => {
    expect(confidenceFromFit(olsFit(FLAT), 6)).toBe(0);
  });

  it("scales down with less history even at r2=1", () => {
    const fit = olsFit([1, 2, 3]);
    expect(confidenceFromFit(fit, 3)).toBeLessThan(100);
  });
});

describe("hasMinimumHistory", () => {
  it("requires the full 6-period window", () => {
    expect(hasMinimumHistory([1, 2, 3, 4, 5])).toBe(false);
  });

  it("requires at least 4 of the last 6 periods with ≥1 NCR", () => {
    expect(hasMinimumHistory([0, 0, 0, 1, 1, 1])).toBe(false); // only 3
    expect(hasMinimumHistory([0, 0, 1, 1, 1, 1])).toBe(true); // exactly 4
    expect(hasMinimumHistory([0, 0, 0, 0, 0, 0])).toBe(false);
  });
});

describe("trailingAverage / riskLevel", () => {
  it("averages the history", () => {
    expect(trailingAverage(LINEAR)).toBeCloseTo(3.5, 10);
  });

  it("buckets by the §3B thresholds (2×/1.5×/1.1× trailing average)", () => {
    expect(riskLevel(7, 3.5, 100)).toBe("critical"); // 2× and confidence ≥60
    expect(riskLevel(7, 3.5, 40)).toBe("high"); // 2× but confidence <60 → falls to next bucket
    expect(riskLevel(5.5, 3.5, 100)).toBe("high"); // 1.57×
    expect(riskLevel(4, 3.5, 100)).toBe("medium"); // 1.14×
    expect(riskLevel(3.5, 3.5, 100)).toBe("low");
  });

  it("never divides by zero for an all-zero trailing average", () => {
    expect(riskLevel(5, 0, 100)).toBe("low");
  });
});

describe("forecastReasoning", () => {
  it("describes a rising, falling, or flat series", () => {
    expect(forecastReasoning(LINEAR)).toBe("NC count rose 1→6 over 6 periods");
    expect(forecastReasoning([6, 5, 4, 3, 2, 1])).toBe("NC count fell 6→1 over 6 periods");
    expect(forecastReasoning(FLAT)).toBe("NC count held steady at 3 over 6 periods");
  });
});

describe("horizonLabel", () => {
  const now = new Date(Date.UTC(2026, 8, 28)); // 2026-09-28

  it("labels month/quarter/half deterministically", () => {
    expect(horizonLabel("month", now)).toBe("2026-10");
    expect(horizonLabel("quarter", now)).toBe("2026-Q4"); // Dec (month 11) → Q4
    expect(horizonLabel("half", now)).toBe("2027-H1"); // +6 months → March 2027
  });
});

describe("computeForecast", () => {
  const now = new Date(Date.UTC(2026, 8, 28));

  it("returns null below the minimum-history gate", () => {
    expect(computeForecast([0, 0, 0, 1, 0, 1], now)).toBeNull();
  });

  it("returns 3 horizon points for a qualifying series, matching the pinned trend", () => {
    const result = computeForecast(LINEAR, now);
    expect(result).not.toBeNull();
    expect(result?.points).toHaveLength(3);
    expect(result?.trailingAverage).toBeCloseTo(3.5, 10);
    const month = result?.points.find((p) => p.horizonKind === "month");
    expect(month?.predictedValue).toBeCloseTo(7, 10);
    expect(month?.bandLow).toBeCloseTo(7, 10); // zero residual → band collapses to the point
    expect(month?.bandHigh).toBeCloseTo(7, 10);
    expect(month?.confidence).toBe(100);
    expect(month?.reasoning).toBe("NC count rose 1→6 over 6 periods");
  });
});

describe("ppapRiskScore", () => {
  it("returns null with no due date or no submitted date", () => {
    expect(ppapRiskScore({ submittedDate: null, dueDate: "2026-12-01", completionRate: 0.5 })).toBeNull();
    expect(ppapRiskScore({ submittedDate: "2026-09-01", dueDate: null, completionRate: 0.5 })).toBeNull();
  });

  it("flags a submission on pace to miss its due date", () => {
    // Submitted 20 days ago at 10% complete, due in 5 days — at this pace it
    // will not finish in time.
    const now = new Date(Date.UTC(2026, 8, 28));
    const submitted = new Date(now.getTime() - 20 * 86_400_000).toISOString();
    const due = new Date(now.getTime() + 5 * 86_400_000).toISOString();
    const score = ppapRiskScore({ submittedDate: submitted, dueDate: due, completionRate: 0.1, now });
    expect(score?.willMissDeadline).toBe(true);
    expect(score?.daysLikelyOver).toBeGreaterThan(0);
  });

  it("does not flag a submission comfortably on pace", () => {
    const now = new Date(Date.UTC(2026, 8, 28));
    const submitted = new Date(now.getTime() - 5 * 86_400_000).toISOString();
    const due = new Date(now.getTime() + 30 * 86_400_000).toISOString();
    const score = ppapRiskScore({ submittedDate: submitted, dueDate: due, completionRate: 0.5, now });
    expect(score?.willMissDeadline).toBe(false);
    expect(score?.daysLikelyOver).toBeNull();
  });
});
