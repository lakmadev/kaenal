import { describe, expect, it } from "vitest";
import { allocateConserved, type AllocationWeight } from "../src/chargeback.js";

const sum = (xs: { amountCents: number }[]): number => xs.reduce((s, x) => s + x.amountCents, 0);

describe("allocateConserved", () => {
  it("splits evenly and stays conserved when it doesn't divide cleanly", () => {
    const out = allocateConserved(100, [
      { key: "a", weight: 1 },
      { key: "b", weight: 1 },
      { key: "c", weight: 1 },
    ]);
    // 100 / 3 → the leftover cent goes to the first bucket (stable tie-break).
    expect(out.map((o) => o.amountCents)).toEqual([34, 33, 33]);
    expect(sum(out)).toBe(100);
  });

  it("allocates proportionally to weight", () => {
    const out = allocateConserved(1000, [
      { key: "big", weight: 30 },
      { key: "small", weight: 10 },
    ]);
    expect(out).toEqual([
      { key: "big", amountCents: 750 },
      { key: "small", amountCents: 250 },
    ]);
    expect(sum(out)).toBe(1000);
  });

  it("is conserved for a large awkward split", () => {
    const weights: AllocationWeight[] = [
      { key: "a", weight: 38 },
      { key: "b", weight: 32 },
      { key: "c", weight: 24 },
      { key: "d", weight: 18 },
      { key: "e", weight: 14 },
      { key: "f", weight: 7 },
    ];
    const out = allocateConserved(613300, weights);
    expect(sum(out)).toBe(613300);
    // Every bucket gets a non-negative whole number of cents.
    for (const o of out) expect(Number.isInteger(o.amountCents)).toBe(true);
  });

  it("gives zero to zero-weight buckets and still conserves", () => {
    const out = allocateConserved(500, [
      { key: "a", weight: 5 },
      { key: "z", weight: 0 },
      { key: "b", weight: 5 },
    ]);
    expect(out.find((o) => o.key === "z")?.amountCents).toBe(0);
    expect(sum(out)).toBe(500);
  });

  it("returns all zeros when there is no weight to attribute to (caller keeps the remainder)", () => {
    const out = allocateConserved(500, [
      { key: "a", weight: 0 },
      { key: "b", weight: 0 },
    ]);
    expect(sum(out)).toBe(0);
    expect(out.every((o) => o.amountCents === 0)).toBe(true);
  });

  it("handles a zero total and an empty bucket list", () => {
    expect(allocateConserved(0, [{ key: "a", weight: 3 }])).toEqual([{ key: "a", amountCents: 0 }]);
    expect(allocateConserved(1000, [])).toEqual([]);
  });
});
