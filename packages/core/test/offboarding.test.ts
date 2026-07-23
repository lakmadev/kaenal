import { describe, expect, it } from "vitest";
import {
  OFFBOARDING_GRACE_DAYS,
  offboardingGraceEndsAt,
  isGraceElapsed,
  isOffboardPurgeEligible,
} from "../src/offboarding.js";

/**
 * Tenant offboarding grace logic (01 §3.4, 07 §5). The 30-day grace is what
 * stands between "offboarding started" and irreversible deletion, so the
 * boundary is pinned exactly.
 */

const start = new Date("2026-07-01T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const plusDays = (n: number): Date => new Date(start.getTime() + n * DAY);

describe("grace period", () => {
  it("ends exactly 30 days after offboarding began", () => {
    expect(OFFBOARDING_GRACE_DAYS).toBe(30);
    expect(offboardingGraceEndsAt(start).toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("has not elapsed within the window, and has on/after the boundary", () => {
    expect(isGraceElapsed(start, plusDays(29))).toBe(false);
    expect(isGraceElapsed(start, plusDays(30))).toBe(true); // boundary is inclusive
    expect(isGraceElapsed(start, plusDays(31))).toBe(true);
  });
});

describe("isOffboardPurgeEligible", () => {
  const now = plusDays(31);

  it("is eligible only for an offboarding tenant past its grace", () => {
    expect(isOffboardPurgeEligible({ status: "offboarding", offboardingAt: start }, now)).toBe(true);
  });

  it("is not eligible before the grace elapses", () => {
    expect(isOffboardPurgeEligible({ status: "offboarding", offboardingAt: plusDays(20) }, now)).toBe(false);
  });

  it("is not eligible for a non-offboarding status", () => {
    expect(isOffboardPurgeEligible({ status: "active", offboardingAt: start }, now)).toBe(false);
    expect(isOffboardPurgeEligible({ status: "offboarded", offboardingAt: start }, now)).toBe(false);
  });

  it("is not eligible without a recorded start", () => {
    expect(isOffboardPurgeEligible({ status: "offboarding", offboardingAt: null }, now)).toBe(false);
  });
});
