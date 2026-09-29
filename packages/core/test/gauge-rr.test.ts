import { describe, expect, it } from "vitest";
import {
  analyzeGaugeRr,
  averageRangeGaugeRr,
  classifyGaugeRrVerdict,
  crossedAnovaGaugeRr,
  GaugeRrError,
  K1_TABLE,
  K2_TABLE,
  K3_TABLE,
  STUDY_VAR_K,
  type GaugeRrMeasurement,
} from "../src/gauge-rr.js";

/**
 * See the doc header of `gauge-rr.ts` for why these fixtures are hand-
 * computed rather than transcribed from the AIAG MSA Reference Manual: this
 * session's network egress policy blocked every host that could serve it
 * (aiag.org, Minitab's `Gageaiag.MTW` reproduction, Wikipedia, spcforexcel.com
 * — checked, not assumed). Every sum of squares, mean square, and variance
 * component below was worked out by hand from a designed appraiser×part
 * interaction table with known row/column sums, then cross-checked with two
 * identities a wrong formula could not pass by accident: (a) `%StudyVar_GRR²
 * + %StudyVar_PartToPart² = 100²` (since `σ²_GRR + σ²_part = σ²_total`), and
 * (b) `√(EV² + AV²) = GRR` for the Average-Range case, both asserted below.
 * `Math.sqrt`/`Math.pow` are used in the assertions themselves (not
 * hand-transcribed decimals) for the irrational stdDev/%StudyVar values, so
 * only the underlying integer sums-of-squares are asserted from a hand
 * derivation, not multi-digit decimals prone to transcription error.
 */

function grid(a: number, p: number, n: number, cellMean: (a: number, p: number) => number, noise: number[]) {
  const measurements: GaugeRrMeasurement[] = [];
  for (let ai = 1; ai <= a; ai++) {
    for (let pi = 1; pi <= p; pi++) {
      const m = cellMean(ai, pi);
      for (let ti = 1; ti <= n; ti++) {
        measurements.push({ appraiser: ai, part: pi, trial: ti, value: m + noise[ti - 1]! });
      }
    }
  }
  return measurements;
}

// Interaction table I(a,p), row & column sums all zero (a genuine, designed
// appraiser×part interaction — not a coincidence of the fixture):
//   [ 4 -4  0]
//   [-4  0  4]
//   [ 0  4 -4]
const INTERACTION: Record<string, number> = {
  "1,1": 4,
  "1,2": -4,
  "1,3": 0,
  "2,1": -4,
  "2,2": 0,
  "2,3": 4,
  "3,1": 0,
  "3,2": 4,
  "3,3": -4,
};
const PART_BASE = [10, 20, 30]; // P1, P2, P3

describe("crossedAnovaGaugeRr — Case A: real interaction, no pooling, reject", () => {
  // apprEffect A1=0, A2=5, A3=-5 (large enough for a real reproducibility signal)
  const apprEffect = [0, 5, -5];
  const cellMean = (a: number, p: number) => PART_BASE[p - 1]! + apprEffect[a - 1]! + INTERACTION[`${a},${p}`]!;
  const measurements = grid(3, 3, 2, cellMean, [-1, 1]); // trial noise ±1 per cell
  const result = crossedAnovaGaugeRr({ appraisers: 3, parts: 3, trials: 2, measurements });

  it("recovers the hand-derived variance components (SS/df worked by hand)", () => {
    // SS_part = 2·3·[(10-20)²+(20-20)²+(30-20)²] = 1200, df=2 → MS=600
    // SS_appraiser = 2·3·[(20-20)²+(25-20)²+(15-20)²] = 300, df=2 → MS=150
    // SS_interaction = 2·ΣΣI² = 2·96 = 192, df=4 → MS=48
    // SS_equipment = Σ(±1)² over 18 points = 18, df=9 → MS=2
    // EV = MS_equipment = 2
    expect(result.repeatability.stdDev ** 2).toBeCloseTo(2, 10);
    // σ²_AxP = max(0,(48-2)/2) = 23
    expect(result.appraiserByPart!.stdDev ** 2).toBeCloseTo(23, 10);
    // σ²_appraiser = max(0,(150-48)/(2·3)) = 17
    expect(result.appraiser!.stdDev ** 2).toBeCloseTo(17, 10);
    // σ²_repro = 17+23 = 40
    expect(result.reproducibility.stdDev ** 2).toBeCloseTo(40, 10);
    // σ²_GRR = 2+40 = 42
    expect(result.grr.stdDev ** 2).toBeCloseTo(42, 10);
    // σ²_part = max(0,(600-48)/(2·3)) = 92
    expect(result.partToPart.stdDev ** 2).toBeCloseTo(92, 10);
    // σ²_total = 42+92 = 134
    expect(result.total.stdDev ** 2).toBeCloseTo(134, 10);
  });

  it("does not pool the interaction (MS_interaction=48 > MS_equipment=2)", () => {
    expect(result.interactionPooled).toBe(false);
  });

  it("computes %StudyVar and ndc from the variance components", () => {
    expect(result.grr.pctStudyVar).toBeCloseTo((100 * Math.sqrt(42)) / Math.sqrt(134), 6);
    expect(result.partToPart.pctStudyVar).toBeCloseTo((100 * Math.sqrt(92)) / Math.sqrt(134), 6);
    expect(result.ndc).toBe(Math.floor(1.41 * (Math.sqrt(92) / Math.sqrt(42))));
    expect(result.ndc).toBe(2);
  });

  it("satisfies %StudyVar_GRR² + %StudyVar_PartToPart² ≈ 100² (variance additivity)", () => {
    expect(result.grr.pctStudyVar ** 2 + result.partToPart.pctStudyVar ** 2).toBeCloseTo(10000, 0);
  });

  it("rejects: %StudyVar_GRR ≥30% (and independently ndc<5)", () => {
    expect(result.grr.pctStudyVar).toBeGreaterThanOrEqual(30);
    expect(result.ndc).toBeLessThan(5);
    expect(result.verdict).toBe("reject");
  });

  it("has no %Tolerance when the study declares none", () => {
    expect(result.grr.pctTolerance).toBeNull();
    expect(result.total.pctTolerance).toBeNull();
  });
});

describe("crossedAnovaGaugeRr — Case B: no real interaction, pooled, acceptable", () => {
  const apprEffect = [0, 1, -1];
  const cellMean = (a: number, p: number) => PART_BASE[p - 1]! + apprEffect[a - 1]!; // no interaction term
  const measurements = grid(3, 3, 2, cellMean, [-0.5, 0.5]);
  const result = crossedAnovaGaugeRr({ appraisers: 3, parts: 3, trials: 2, measurements, tolerance: 50 });

  it("pools the interaction into equipment (MS_interaction=0 ≤ MS_equipment=0.5)", () => {
    expect(result.interactionPooled).toBe(true);
    expect(result.appraiserByPart?.stdDev).toBeCloseTo(0, 10);
  });

  it("recovers the hand-derived variance components", () => {
    // SS_appraiser = 2·3·[(20-20)²+(21-20)²+(19-20)²] = 12, df=2 → MS=6
    // SS_equipment = Σ(±0.5)² over 18 points = 4.5, df=9 → MS=0.5
    expect(result.repeatability.stdDev ** 2).toBeCloseTo(0.5, 10);
    expect(result.appraiser!.stdDev ** 2).toBeCloseTo(1, 10); // (6-0)/(2·3)
    expect(result.reproducibility.stdDev ** 2).toBeCloseTo(1, 10);
    expect(result.partToPart.stdDev ** 2).toBeCloseTo(100, 10); // (600-0)/(2·3)
    expect(result.grr.stdDev ** 2).toBeCloseTo(1.5, 10);
    expect(result.total.stdDev ** 2).toBeCloseTo(101.5, 10);
  });

  it("is acceptable: 10% ≤ %StudyVar_GRR < 30% and ndc ≥ 5", () => {
    expect(result.grr.pctStudyVar).toBeGreaterThanOrEqual(10);
    expect(result.grr.pctStudyVar).toBeLessThan(30);
    expect(result.ndc).toBeGreaterThanOrEqual(5);
    expect(result.verdict).toBe("acceptable");
  });

  it("computes %Tolerance once a tolerance is declared", () => {
    const expected = (100 * result.grr.studyVariation) / 50;
    expect(result.grr.pctTolerance).toBeCloseTo(expected, 10);
    expect(result.grr.pctTolerance).not.toBeNull();
  });
});

describe("crossedAnovaGaugeRr — Case C: identical appraisers, tight noise, excellent", () => {
  const cellMean = (_a: number, p: number) => PART_BASE[p - 1]!; // no appraiser or interaction effect at all
  const measurements = grid(3, 3, 2, cellMean, [-0.3, 0.3]);
  const result = crossedAnovaGaugeRr({ appraisers: 3, parts: 3, trials: 2, measurements });

  it("pools the interaction and finds zero appraiser variance", () => {
    expect(result.interactionPooled).toBe(true);
    expect(result.appraiser?.stdDev).toBeCloseTo(0, 10);
    expect(result.appraiserByPart?.stdDev).toBeCloseTo(0, 10);
  });

  it("is excellent: %StudyVar_GRR < 10%", () => {
    // MS_equipment = Σ(±0.3)² over 18 points / 9 = 0.18 → GRR σ² = 0.18, total σ² = 100.18
    expect(result.grr.stdDev ** 2).toBeCloseTo(0.18, 10);
    expect(result.grr.pctStudyVar).toBeLessThan(10);
    expect(result.ndc).toBeGreaterThanOrEqual(5);
    expect(result.verdict).toBe("excellent");
  });
});

describe("crossedAnovaGaugeRr — guards", () => {
  it("throws below the 2/2/2 floor (degrees of freedom would hit 0)", () => {
    expect(() => crossedAnovaGaugeRr({ appraisers: 1, parts: 3, trials: 2, measurements: [] })).toThrow(
      GaugeRrError,
    );
  });

  it("throws on a measurement outside the declared design", () => {
    const measurements = grid(2, 2, 2, () => 10, [0, 0]);
    measurements.push({ appraiser: 3, part: 1, trial: 1, value: 5 }); // appraiser 3 doesn't exist in a 2x2x2 design
    expect(() => crossedAnovaGaugeRr({ appraisers: 2, parts: 2, trials: 2, measurements })).toThrow(GaugeRrError);
  });

  it("throws when the grid is missing a cell (incomplete study)", () => {
    const measurements = grid(2, 2, 2, () => 10, [0, 0]).slice(0, -1); // drop the last trial
    expect(() => crossedAnovaGaugeRr({ appraisers: 2, parts: 2, trials: 2, measurements })).toThrow(GaugeRrError);
  });
});

describe("K-factor tables (AIAG MSA 4th ed., transcribed from SPRINT-04 §3.2)", () => {
  it("K1 (trials) matches the sprint's given values", () => {
    expect(K1_TABLE[2]).toBe(4.56);
    expect(K1_TABLE[3]).toBe(3.05);
  });
  it("K2 (appraisers) matches the sprint's given values", () => {
    expect(K2_TABLE[2]).toBe(3.65);
    expect(K2_TABLE[3]).toBe(2.7);
  });
  it("K3 (parts) shares K2's table for overlapping group sizes (same d2*(g,1) formula)", () => {
    expect(K3_TABLE[2]).toBe(K2_TABLE[2]);
    expect(K3_TABLE[3]).toBe(K2_TABLE[3]);
    expect(Object.keys(K3_TABLE)).toHaveLength(9); // parts 2-10
  });
});

describe("averageRangeGaugeRr — hand-computed X̄/R example, acceptable", () => {
  // 3 appraisers × 5 parts × 3 trials. Part bases 10/20/30/40/50; appraiser
  // biases 0/+2/-2; every cell's 3 trials are [mean-1, mean, mean+1] (range 2
  // in every cell, so R̄ = 2 exactly).
  const partBase = [10, 20, 30, 40, 50];
  const apprBias = [0, 2, -2];
  const cellMean = (a: number, p: number) => partBase[p - 1]! + apprBias[a - 1]!;
  const measurements = grid(3, 5, 3, cellMean, [-1, 0, 1]);
  const result = averageRangeGaugeRr({ appraisers: 3, parts: 5, trials: 3, measurements, tolerance: 100 });

  // Hand-derived classical (5.15σ-level) quantities:
  //   R̄ = 2 (every cell range is 2)              → EV = R̄·K1(3) = 2·3.05 = 6.10
  //   X̄_diff = |32-28| = 4 (appraiser means 30/32/28) → AV = √[(4·K2(3))² - EV²/(5·3)]
  //                                                          = √[(4·2.70)² - 6.10²/15] = √114.159333...
  //   R_P = |50-10| = 40 (part means 10/20/30/40/50)  → PV = R_P·K3(5) = 40·2.08 = 83.2
  const EV = 2 * K1_TABLE[3]!;
  const AV = Math.sqrt((4 * K2_TABLE[3]!) ** 2 - EV ** 2 / (5 * 3));
  const PV = 40 * K3_TABLE[5]!;

  it("recovers the classical EV/AV/PV as study-variation-level quantities", () => {
    expect(result.repeatability.studyVariation).toBeCloseTo(EV, 6);
    expect(result.reproducibility.studyVariation).toBeCloseTo(AV, 6);
    expect(result.partToPart.studyVariation).toBeCloseTo(PV, 6);
  });

  it("GRR = √(EV² + AV²) and Total = √(GRR² + PV²) (classical identity)", () => {
    const grr = Math.sqrt(EV ** 2 + AV ** 2);
    const total = Math.sqrt(grr ** 2 + PV ** 2);
    expect(result.grr.studyVariation).toBeCloseTo(grr, 6);
    expect(result.total.studyVariation).toBeCloseTo(total, 6);
  });

  it("has no separate appraiser/interaction rows (not estimated by this method)", () => {
    expect(result.appraiser).toBeNull();
    expect(result.appraiserByPart).toBeNull();
    expect(result.interactionPooled).toBeNull();
  });

  it("computes ndc and lands in the acceptable band", () => {
    const grr = Math.sqrt(EV ** 2 + AV ** 2);
    expect(result.ndc).toBe(Math.floor(1.41 * (PV / grr)));
    expect(result.ndc).toBe(9);
    expect(result.grr.pctStudyVar).toBeGreaterThanOrEqual(10);
    expect(result.grr.pctStudyVar).toBeLessThan(30);
    expect(result.verdict).toBe("acceptable");
  });

  it("computes %Tolerance from the declared tolerance", () => {
    const grr = Math.sqrt(EV ** 2 + AV ** 2);
    expect(result.grr.pctTolerance).toBeCloseTo((100 * grr) / 100, 6);
  });
});

describe("averageRangeGaugeRr — bounds", () => {
  it("throws outside the published K-table domain (trials/appraisers/parts)", () => {
    const measurements = grid(3, 5, 3, () => 10, [-1, 0, 1]);
    expect(() =>
      averageRangeGaugeRr({ appraisers: 4, parts: 5, trials: 3, measurements: [] }),
    ).toThrow(GaugeRrError); // K2 has no entry for 4 appraisers
    expect(() =>
      averageRangeGaugeRr({ appraisers: 3, parts: 11, trials: 3, measurements: [] }),
    ).toThrow(GaugeRrError); // K3 has no entry for 11 parts
    expect(measurements.length).toBe(3 * 5 * 3); // sanity: the valid grid used elsewhere is well-formed
  });
});

describe("classifyGaugeRrVerdict — explicit if/elif/else, reject checked first", () => {
  it("excellent just below 10%", () => {
    expect(classifyGaugeRrVerdict(9.999, 20)).toBe("excellent");
  });
  it("acceptable exactly at 10% (the AC's own boundary)", () => {
    expect(classifyGaugeRrVerdict(10, 20)).toBe("acceptable");
  });
  it("acceptable just below 30%", () => {
    expect(classifyGaugeRrVerdict(29.999, 20)).toBe("acceptable");
  });
  it("reject exactly at 30% (reject is >=, not >)", () => {
    expect(classifyGaugeRrVerdict(30, 20)).toBe("reject");
  });
  it("acceptable exactly at ndc=5", () => {
    expect(classifyGaugeRrVerdict(15, 5)).toBe("acceptable");
  });
  it("reject when ndc=4, even with a mid-range %StudyVar (ndc wins)", () => {
    expect(classifyGaugeRrVerdict(15, 4)).toBe("reject");
  });
  it("reject when both conditions independently hold", () => {
    expect(classifyGaugeRrVerdict(50, 2)).toBe("reject");
  });
  it("reject-first precedence: a high %StudyVar is never shadowed by checking ndc first", () => {
    expect(classifyGaugeRrVerdict(99, 100)).toBe("reject");
  });
});

describe("analyzeGaugeRr — dispatch", () => {
  it("routes to crossedAnovaGaugeRr", () => {
    const cellMean = (_a: number, p: number) => PART_BASE[p - 1]!;
    const measurements = grid(3, 3, 2, cellMean, [-0.3, 0.3]);
    const result = analyzeGaugeRr({ appraisers: 3, parts: 3, trials: 2, measurements, method: "crossed_anova" });
    expect(result.method).toBe("crossed_anova");
  });

  it("routes to averageRangeGaugeRr", () => {
    const measurements = grid(3, 5, 3, () => 10, [-1, 0, 1]);
    const result = analyzeGaugeRr({ appraisers: 3, parts: 5, trials: 3, measurements, method: "average_range" });
    expect(result.method).toBe("average_range");
  });
});

describe("STUDY_VAR_K", () => {
  it("is the AIAG 4th-edition default (99% coverage)", () => {
    expect(STUDY_VAR_K).toBe(5.15);
  });
});
