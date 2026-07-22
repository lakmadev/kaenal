import { describe, expect, it } from "vitest";
import { activeExpiryThreshold, daysUntilExpiry, EXPIRY_THRESHOLDS } from "../src/document-expiry.js";

/**
 * Document expiry thresholds (06 §1 `docs`). The reminder cascade (90 → 30 → 7)
 * and the "most urgent applicable" selection are the whole rule, so the
 * boundaries are pinned exactly — the difference between a 30-day and a 31-day
 * document is one notification.
 */

const now = new Date("2026-07-22T00:00:00Z");
const inDays = (n: number): Date => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe("daysUntilExpiry", () => {
  it("rounds up partial days and goes negative once expired", () => {
    expect(daysUntilExpiry(inDays(30), now)).toBe(30);
    expect(daysUntilExpiry(new Date(now.getTime() + 29.5 * 24 * 3600 * 1000), now)).toBe(30);
    expect(daysUntilExpiry(inDays(-2), now)).toBe(-2);
  });
});

describe("activeExpiryThreshold", () => {
  it("is null when the document is more than 90 days out", () => {
    expect(activeExpiryThreshold(inDays(120), now)).toBeNull();
    expect(activeExpiryThreshold(inDays(91), now)).toBeNull();
  });

  it("fires each threshold at its boundary", () => {
    expect(activeExpiryThreshold(inDays(90), now)).toBe(90);
    expect(activeExpiryThreshold(inDays(31), now)).toBe(90);
    expect(activeExpiryThreshold(inDays(30), now)).toBe(30);
    expect(activeExpiryThreshold(inDays(8), now)).toBe(30);
    expect(activeExpiryThreshold(inDays(7), now)).toBe(7);
  });

  it("surfaces the most urgent notice for a near or already-expired document", () => {
    expect(activeExpiryThreshold(inDays(1), now)).toBe(7);
    expect(activeExpiryThreshold(inDays(0), now)).toBe(7);
    expect(activeExpiryThreshold(inDays(-10), now)).toBe(7);
  });

  it("uses the documented 90/30/7 cascade", () => {
    expect([...EXPIRY_THRESHOLDS]).toEqual([90, 30, 7]);
  });
});
