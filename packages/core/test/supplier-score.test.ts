import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORE_WEIGHTS,
  scoreSupplier,
  supplierGrade,
  weightedSupplierScore,
  type SupplierMetrics,
} from "../src/supplier-score.js";

/**
 * Supplier scorecard weighting (P08). The fixtures below are lifted from the
 * visual spec's seed data (`suppliers-data.js`) so the grades line up with what
 * the prototype shows: Bharat Forge (all KPIs beat target) is an A; Ningbo
 * CastingWorks (PPM 5× target, OTD/OQE/SCAR all missing target) is a D.
 */

describe("weightedSupplierScore", () => {
  it("scores a supplier that beats every target at/near 100 (Bharat Forge profile)", () => {
    const m: SupplierMetrics = {
      ppm: 28, ppmTarget: 50, // under target → 100
      otd: 99.1, otdTarget: 98, // over target → 100
      oqe: 96, oqeTarget: 90, // over target → 100
      scarHours: 12, scarTarget: 48, // well under → 100
    };
    expect(weightedSupplierScore(m)).toBe(100);
    expect(scoreSupplier(m).grade).toBe("A");
  });

  it("scores a chronic under-performer low (Ningbo CastingWorks profile)", () => {
    const m: SupplierMetrics = {
      ppm: 482, ppmTarget: 100, // ~4.8× → ~21
      otd: 89.2, otdTarget: 95, // ~94
      oqe: 58, oqeTarget: 80, // ~72
      scarHours: 96, scarTarget: 48, // 2× → 50
    };
    const s = weightedSupplierScore(m);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(60);
    expect(supplierGrade(s)).toBe("D");
  });

  it("respects the weights — heavier PPM weight punishes a PPM miss harder", () => {
    const m: SupplierMetrics = {
      ppm: 200, ppmTarget: 100, // score 50
      otd: 100, otdTarget: 100, // score 100
      oqe: 100, oqeTarget: 100,
      scarHours: 10, scarTarget: 10,
    };
    const ppmHeavy = weightedSupplierScore(m, { ppm: 0.9, otd: 0.05, oqe: 0.03, scar: 0.02 });
    const ppmLight = weightedSupplierScore(m, { ppm: 0.1, otd: 0.3, oqe: 0.3, scar: 0.3 });
    expect(ppmHeavy).toBeLessThan(ppmLight);
  });

  it("drops absent metrics rather than zeroing them (raw-material supplier, no PPM)", () => {
    const m: SupplierMetrics = {
      ppm: null, ppmTarget: null, // raw material — no PPM
      otd: 98.2, otdTarget: 96,
      oqe: 94, oqeTarget: 88,
      scarHours: 22, scarTarget: 72,
    };
    // Scored only on OTD/OQE/SCAR, all beating target → strong score, not dragged to ~60 by a phantom PPM 0.
    expect(weightedSupplierScore(m)).toBe(100);
  });

  it("returns 0 for a supplier with no metrics at all", () => {
    expect(weightedSupplierScore({})).toBe(0);
    expect(scoreSupplier({}).grade).toBe("D");
  });

  it("treats a zero PPM target as 'any defect is a miss'", () => {
    expect(weightedSupplierScore({ ppm: 5, ppmTarget: 0 })).toBe(0);
    expect(weightedSupplierScore({ ppm: 0, ppmTarget: 0 })).toBe(100);
  });

  it("default weights sum to 1", () => {
    const { ppm, otd, oqe, scar } = DEFAULT_SCORE_WEIGHTS;
    expect(ppm + otd + oqe + scar).toBeCloseTo(1);
  });
});

describe("supplierGrade", () => {
  it("maps score bands to A/B/C/D", () => {
    expect(supplierGrade(95)).toBe("A");
    expect(supplierGrade(90)).toBe("A");
    expect(supplierGrade(80)).toBe("B");
    expect(supplierGrade(60)).toBe("C");
    expect(supplierGrade(59)).toBe("D");
    expect(supplierGrade(0)).toBe("D");
  });
});
