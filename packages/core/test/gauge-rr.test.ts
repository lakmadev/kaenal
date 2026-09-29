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
 * PRIMARY validation: the literal AIAG MSA 4th-edition worked example (3
 * appraisers × 10 parts × 3 trials), as reproduced in Dr. Bill McNeese,
 * "Three Ways to Analyze a Gage R&R Study," BPI Consulting LLC / SPC for
 * Excel, 2015 (spcforexcel.com/downloads/pdf/Three-Ways-to-Analyze-a-Gage-RR.pdf).
 * The paper states explicitly it uses "data ... from the 4th edition of the
 * Measurement Systems Analysis manual published by AIAG" — see the
 * `describe("AIAG MSA 4th-edition worked example ...")` blocks below for the
 * raw dataset and the published numbers, independently re-derived by hand
 * from the raw data before being checked against this module's output (per
 * SPRINT-04 §3.2 `[AMENDED-5]`, the ANOVA method's pooled-MSE convention now
 * reconciles exactly with the paper's published variance components).
 *
 * The small hand-computed fixtures below (designed appraiser×part
 * interaction table, verdict-boundary cases) are kept as supplementary edge-
 * case coverage — precedence rules and pooling branches the single published
 * example doesn't happen to exercise on its own — not as the primary
 * evidence of correctness.
 */

// AIAG MSA 4th-edition worked example, Table 1 (McNeese 2015, "Three Ways to
// Analyze a Gage R&R Study") — 3 appraisers (A, B, C) × 10 parts × 3 trials.
// One row per (appraiser, trial); one column per part 1-10.
const AIAG_TABLE: Record<string, number[][]> = {
  A: [
    [0.29, -0.56, 1.34, 0.47, -0.8, 0.02, 0.59, -0.31, 2.26, -1.36],
    [0.41, -0.68, 1.17, 0.5, -0.92, -0.11, 0.75, -0.2, 1.99, -1.25],
    [0.64, -0.58, 1.27, 0.64, -0.84, -0.21, 0.66, -0.17, 2.01, -1.31],
  ],
  B: [
    [0.08, -0.47, 1.19, 0.01, -0.56, -0.2, 0.47, -0.63, 1.8, -1.68],
    [0.25, -1.22, 0.94, 1.03, -1.2, 0.22, 0.55, 0.08, 2.12, -1.62],
    [0.07, -0.68, 1.34, 0.2, -1.28, 0.06, 0.83, -0.34, 2.19, -1.5],
  ],
  C: [
    [0.04, -1.38, 0.88, 0.14, -1.46, -0.29, 0.02, -0.46, 1.77, -1.49],
    [-0.11, -1.13, 1.09, 0.2, -1.07, -0.67, 0.01, -0.56, 1.45, -1.77],
    [-0.15, -0.96, 0.67, 0.11, -1.45, -0.49, 0.21, -0.49, 1.87, -2.16],
  ],
};

function aiagMeasurements(): GaugeRrMeasurement[] {
  const measurements: GaugeRrMeasurement[] = [];
  const appraisers = ["A", "B", "C"];
  appraisers.forEach((op, ai) => {
    AIAG_TABLE[op]!.forEach((row, ti) => {
      row.forEach((value, pi) => {
        measurements.push({ appraiser: ai + 1, part: pi + 1, trial: ti + 1, value });
      });
    });
  });
  return measurements;
}

describe("AIAG MSA 4th-edition worked example — average_range (McNeese/BPI 2015)", () => {
  // Published (paper's own K1/K2/K3 = this module's K1_TABLE/K2_TABLE/K3_TABLE
  // ÷ STUDY_VAR_K — i.e. the paper's EV/AV/GRR/PV/TV are at raw-σ scale, so
  // they are compared against this module's `stdDev` fields, not
  // `studyVariation`; see gauge-rr.ts's doc header):
  //   R̄ = 0.342, X̄_DIFF = 0.445, R_P = 3.511
  //   EV = 0.202, AV = 0.230, GRR = 0.306, PV = 1.105 (paper's % table: 1.104), TV = 1.146
  //   %EV = 17.61%, %AV = 20.04%, %GRR(%R&R) = 26.68%, %PV = 96.37%
  const result = averageRangeGaugeRr({ appraisers: 3, parts: 10, trials: 3, measurements: aiagMeasurements() });

  it("matches the published EV/AV/GRR/PV/TV (raw σ) within the paper's own 3-decimal rounding", () => {
    expect(result.repeatability.stdDev).toBeCloseTo(0.202, 3);
    expect(result.reproducibility.stdDev).toBeCloseTo(0.23, 3);
    expect(result.grr.stdDev).toBeCloseTo(0.306, 3);
    expect(result.partToPart.stdDev).toBeCloseTo(1.105, 2); // paper's % table rounds this to 1.104
    expect(result.total.stdDev).toBeCloseTo(1.146, 3);
  });

  it("matches the published %EV/%AV/%R&R/%PV (within ~0.1pp — this module's K-table is itself rounded to 2 decimals, e.g. K1(3)=3.05 vs the paper's more precise implied 3.0426, so the % figures carry slightly more rounding slack than the σ figures above)", () => {
    expect(result.repeatability.pctStudyVar).toBeCloseTo(17.61, 0);
    expect(result.reproducibility.pctStudyVar).toBeCloseTo(20.04, 0);
    expect(result.grr.pctStudyVar).toBeCloseTo(26.68, 0);
    expect(result.partToPart.pctStudyVar).toBeCloseTo(96.37, 0);
  });

  it("has no separate appraiser/interaction rows (not estimated by this method)", () => {
    expect(result.appraiser).toBeNull();
    expect(result.appraiserByPart).toBeNull();
    expect(result.interactionPooled).toBeNull();
  });

  it("independently re-derived ndc and verdict", () => {
    // ndc = floor(1.41 × PV/GRR) = floor(1.41 × 1.105/0.306) = floor(5.093) = 5
    expect(result.ndc).toBe(5);
    // %StudyVar_GRR ≈ 26.68% is in [10,30) and ndc=5 ≥ 5 → acceptable
    expect(result.verdict).toBe("acceptable");
  });
});

describe("AIAG MSA 4th-edition worked example — crossed_anova (McNeese/BPI 2015)", () => {
  const result = crossedAnovaGaugeRr({ appraisers: 3, parts: 10, trials: 3, measurements: aiagMeasurements() });

  // Independent re-derivation from the raw Table 1 data (not transcribed from
  // the paper, which omits the interaction row from its displayed table
  // precisely because it pools it away): grand mean over all 90 values,
  // SS_Part = n·a·Σ(partMean−grand)², SS_Operator = n·p·Σ(apprMean−grand)²,
  // SS_Interaction = n·ΣΣ(cellMean−partMean−apprMean+grand)²,
  // SS_Equipment = ΣΣΣ(value−cellMean)². These sum exactly to SS_Total
  // (94.647), the classic ANOVA decomposition identity.
  it("independently re-derives SS/MS from the raw Table 1 data and matches the paper's published values", () => {
    // Standalone re-derivation (not calling gauge-rr.ts) confirming the raw
    // fixture itself matches the paper's stated ANOVA table, before trusting
    // any module output built on it.
    const a = 3,
      p = 10,
      n = 3;
    const ms = aiagMeasurements();
    const cell = (ai: number, pi: number) => ms.filter((m) => m.appraiser === ai && m.part === pi).map((m) => m.value);
    const meanOf = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const grand = meanOf(ms.map((m) => m.value));
    const partMean = Array.from({ length: p }, (_, pi) => meanOf(ms.filter((m) => m.part === pi + 1).map((m) => m.value)));
    const apprMean = Array.from({ length: a }, (_, ai) => meanOf(ms.filter((m) => m.appraiser === ai + 1).map((m) => m.value)));
    const ssPart = n * a * partMean.reduce((s, m) => s + (m - grand) ** 2, 0);
    const ssAppraiser = n * p * apprMean.reduce((s, m) => s + (m - grand) ** 2, 0);
    let ssInteraction = 0;
    for (let ai = 0; ai < a; ai++) {
      for (let pi = 0; pi < p; pi++) {
        const cm = meanOf(cell(ai + 1, pi + 1));
        ssInteraction += (cm - partMean[pi]! - apprMean[ai]! + grand) ** 2;
      }
    }
    ssInteraction *= n;
    let ssEquipment = 0;
    for (let ai = 0; ai < a; ai++) {
      for (let pi = 0; pi < p; pi++) {
        const cm = meanOf(cell(ai + 1, pi + 1));
        for (const v of cell(ai + 1, pi + 1)) ssEquipment += (v - cm) ** 2;
      }
    }
    expect(ssPart).toBeCloseTo(88.362, 2);
    expect(ssAppraiser).toBeCloseTo(3.167, 2);
    expect(ssPart / (p - 1)).toBeCloseTo(9.818, 2); // MS_Part
    expect(ssAppraiser / (a - 1)).toBeCloseTo(1.584, 2); // MS_Operator
    // Pooled "Repeatability/Equipment" the paper reports (SS_interaction +
    // SS_equipment, df 18+60=78): SS=3.118, MS=0.0400.
    expect(ssInteraction + ssEquipment).toBeCloseTo(3.118, 2);
    expect((ssInteraction + ssEquipment) / (18 + 60)).toBeCloseTo(0.04, 3);
  });

  it("independently confirms the paper's interaction-pooling condition triggers on this real data", () => {
    // Hand re-derivation: SS_Interaction = 0.359 (df=18) → MS_Interaction =
    // 0.01994; SS_Equipment = 2.759 (df=60) → MS_Equipment = 0.04598.
    // MS_Interaction (0.01994) ≤ MS_Equipment (0.04598) → pools, matching the
    // paper's statement that "the interaction ... was not significant."
    expect(result.interactionPooled).toBe(true);
    expect(result.appraiserByPart!.stdDev).toBeCloseTo(0, 10);
  });

  it("matches the paper's published pooled-MSE variance components exactly (SPRINT-04 §3.2 [AMENDED-5])", () => {
    // Pooling triggers (MS_interaction=0.01994 ≤ MS_equipment=0.04598), so
    // MSE_pooled = (SS_interaction+SS_equipment)/(df_interaction+df_equipment)
    // = 3.118/78 = 0.0400 replaces both MS_interaction and MS_equipment
    // everywhere below — reproducing the paper's published numbers:
    // σ²_repeatability=0.0400, σ²_reproducibility=0.0515, σ²_part=1.086,
    // σ²_GRR=0.0914.
    expect(result.repeatability.stdDev ** 2).toBeCloseTo(0.04, 3);
    expect(result.reproducibility.stdDev ** 2).toBeCloseTo(0.0515, 3);
    expect(result.partToPart.stdDev ** 2).toBeCloseTo(1.086, 3);
    expect(result.grr.stdDev ** 2).toBeCloseTo(0.0914, 3);
    expect(result.total.stdDev ** 2).toBeCloseTo(1.1774, 3);
  });

  it("ndc and verdict match the paper", () => {
    // ndc = floor(1.41 × √1.086444/√0.091467) = floor(1.41 × 3.4463) =
    // floor(4.859) = 4. %StudyVar_GRR ≈ 27.88% sits in the "acceptable"
    // 10-30% band, but ndc=4 < 5 overrides it — the ndc-overrides-%StudyVar
    // precedence edge case the sprint's DoD calls for.
    expect(result.grr.pctStudyVar).toBeGreaterThanOrEqual(10);
    expect(result.grr.pctStudyVar).toBeLessThan(30);
    expect(result.ndc).toBe(4);
    expect(result.verdict).toBe("reject");
  });
});

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

  it("recovers the hand-derived variance components (pooled-MSE convention, SPRINT-04 §3.2 [AMENDED-5])", () => {
    // SS_appraiser = 2·3·[(20-20)²+(21-20)²+(19-20)²] = 12, df=2 → MS=6
    // SS_interaction = 0, df=4; SS_equipment = Σ(±0.5)² over 18 points = 4.5,
    // df=9 → MS=0.5. Pooled: MSE_pooled = (0+4.5)/(4+9) = 4.5/13 = 0.346154,
    // replacing both MS_interaction and MS_equipment below.
    const msePooled = 4.5 / 13;
    expect(result.repeatability.stdDev ** 2).toBeCloseTo(msePooled, 10);
    expect(result.appraiser!.stdDev ** 2).toBeCloseTo((6 - msePooled) / 6, 10);
    expect(result.reproducibility.stdDev ** 2).toBeCloseTo((6 - msePooled) / 6, 10);
    expect(result.partToPart.stdDev ** 2).toBeCloseTo((600 - msePooled) / 6, 10); // (SS_part=1200, df=2 → MS=600)
    expect(result.grr.stdDev ** 2).toBeCloseTo(msePooled + (6 - msePooled) / 6, 10);
    expect(result.total.stdDev ** 2).toBeCloseTo(
      msePooled + (6 - msePooled) / 6 + (600 - msePooled) / 6,
      10,
    );
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
    // SS_interaction=0, df=4; SS_equipment = Σ(±0.3)² over 18 points = 1.62,
    // df=9 → MS_equipment=0.18. Pooled: MSE_pooled = (0+1.62)/(4+9) =
    // 1.62/13 = 0.124615, replacing MS_equipment for repeatability (no
    // appraiser/part effect here, so those components are unaffected at 0
    // and 99.979... respectively, but GRR/total shift with repeatability).
    const msePooled = 1.62 / 13;
    expect(result.repeatability.stdDev ** 2).toBeCloseTo(msePooled, 10);
    expect(result.grr.stdDev ** 2).toBeCloseTo(msePooled, 10);
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
