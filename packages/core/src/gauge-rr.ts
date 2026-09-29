/**
 * Gauge R&R / Measurement System Analysis math (SPRINT-04 M1; `qms-risk-spc.jsx:549-671`).
 *
 * Both AIAG 4th-edition methods for a crossed `a` appraisers × `p` parts ×
 * `n` trials study — ANOVA (`crossed_anova`) and Average & Range
 * (`average_range`) — implemented exactly per SPRINT-04-risk-msa.md §3.2
 * (the user-approved backend design), mirroring `spc.ts`'s
 * "AIAG-adjacent math, unit-tested against a documented example" precedent
 * and `fmea.ts`'s pure-scoring-logic style. Pure — no DB — so a study's
 * analysis is always recomputed from its real measurements, never stored.
 *
 * **Validation note:** this module's PRIMARY validation (both methods) is the
 * literal AIAG MSA 4th-edition worked example (3 appraisers × 10 parts × 3
 * trials), as reproduced by Dr. Bill McNeese, "Three Ways to Analyze a Gage
 * R&R Study," BPI Consulting LLC / SPC for Excel, 2015
 * (spcforexcel.com/downloads/pdf/Three-Ways-to-Analyze-a-Gage-RR.pdf), which
 * states explicitly it uses "data ... from the 4th edition of the Measurement
 * Systems Analysis manual published by AIAG." See `gauge-rr.test.ts` for the
 * full raw dataset, the independent SS/MS re-derivation, and the published
 * numbers it is checked against.
 *
 * The Average & Range method (`average_range`) reconciles exactly: the
 * paper's own EV/AV/GRR/PV/TV figures equal this module's `stdDev` fields
 * (raw σ) once you note the paper's K1/K2/K3 constants (0.5908/0.5231/0.3146)
 * are this module's `K1_TABLE`/`K2_TABLE`/`K3_TABLE` values already divided
 * by {@link STUDY_VAR_K} — i.e. the paper reports EV/AV/PV/GRR/TV at raw-σ
 * scale, not at this module's `studyVariation` (5.15σ) scale. Same number,
 * different unit label; not a formula discrepancy.
 *
 * The ANOVA method (`crossed_anova`) reconciles exactly on the paper's
 * published pooled variance-component numbers (σ²_repeatability=0.0400,
 * σ²_reproducibility=0.0515, σ²_part=1.086, σ²_GRR=0.0914), per SPRINT-04
 * §3.2 `[AMENDED-5]`: when interaction pooling triggers
 * (`MS_interaction ≤ MS_equipment`), a merged error term `MSE_pooled =
 * (SS_interaction + SS_equipment) / (df_interaction + df_equipment)` is
 * substituted for BOTH `MS_interaction` and `MS_equipment` in every
 * downstream formula (repeatability included, not just the appraiser×part
 * term). An earlier "zero-out" variant only zeroed the appraiser×part
 * component on pooling without redistributing its SS into repeatability;
 * that diverged ~7% on σ²_GRR from this same published example and was
 * corrected by `[AMENDED-5]` — see the test file for the worked numbers.
 */

export type MsaMethod = "crossed_anova" | "average_range";
export type GaugeRrVerdict = "excellent" | "acceptable" | "reject";

export class GaugeRrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GaugeRrError";
  }
}

export interface GaugeRrMeasurement {
  readonly appraiser: number; // 1-based, 1..appraisers
  readonly part: number; // 1-based, 1..parts
  readonly trial: number; // 1-based, 1..trials
  readonly value: number;
}

export interface GaugeRrStudyInput {
  readonly appraisers: number;
  readonly parts: number;
  readonly trials: number;
  readonly measurements: readonly GaugeRrMeasurement[];
  /** Spec tolerance (USL−LSL); omit/null when the study declares none. */
  readonly tolerance?: number | null;
}

/** One variance source's row in the report (EV, AV, GRR, PV, Total, …). */
export interface GaugeRrSourceResult {
  readonly stdDev: number;
  /** `stdDev × 5.15` ({@link STUDY_VAR_K}) — the AIAG "study variation". */
  readonly studyVariation: number;
  readonly pctStudyVar: number;
  /** `null` when the study has no declared tolerance (never a fabricated number or ÷0). */
  readonly pctTolerance: number | null;
}

export interface GaugeRrResult {
  readonly method: MsaMethod;
  readonly repeatability: GaugeRrSourceResult; // EV
  /** Raw operator effect — `crossed_anova` only; `null` for `average_range` (not separately estimated by that method). */
  readonly appraiser: GaugeRrSourceResult | null;
  /** Appraiser×part interaction — `crossed_anova` only; `null` for `average_range`. */
  readonly appraiserByPart: GaugeRrSourceResult | null;
  readonly reproducibility: GaugeRrSourceResult; // AV
  readonly grr: GaugeRrSourceResult; // Total Gauge R&R
  readonly partToPart: GaugeRrSourceResult; // PV
  readonly total: GaugeRrSourceResult; // always 100% StudyVar, by definition
  readonly ndc: number;
  readonly verdict: GaugeRrVerdict;
  /**
   * Whether the ANOVA interaction term was pooled into equipment
   * (`MS_interaction ≤ MS_equipment`) — `null` for `average_range`, which has
   * no interaction term to pool.
   */
  readonly interactionPooled: boolean | null;
}

/** AIAG 4th-edition default multiplier (99% coverage) — SPRINT-04 §3.2. */
export const STUDY_VAR_K = 5.15;

/**
 * AIAG MSA published Average & Range K-factor tables (§3.2, transcribed
 * verbatim from the approved sprint text / AIAG MSA Reference Manual, 4th
 * ed.). K1: repeatability, by trial count. K2: reproducibility, by appraiser
 * count. K3: part-to-part, by part count — the manual's own documented
 * extension of the K2 table (same `5.15/d2*(g,1)` formula) to group sizes up
 * to 10, which is why K3(2)/K3(3) equal K2(2)/K2(3) exactly.
 */
export const K1_TABLE: Readonly<Record<number, number>> = { 2: 4.56, 3: 3.05 };
export const K2_TABLE: Readonly<Record<number, number>> = { 2: 3.65, 3: 2.7 };
export const K3_TABLE: Readonly<Record<number, number>> = {
  2: 3.65,
  3: 2.7,
  4: 2.3,
  5: 2.08,
  6: 1.93,
  7: 1.82,
  8: 1.74,
  9: 1.67,
  10: 1.62,
};

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Arranges measurements into `grid[appraiser-1][part-1] = trial values`,
 * validating full coverage of the declared `a×p×n` design — a study missing
 * cells (M1's "incomplete study" state) or carrying an out-of-range index
 * throws rather than silently computing a wrong or partial result.
 */
function groupMeasurements(
  input: Pick<GaugeRrStudyInput, "appraisers" | "parts" | "trials" | "measurements">,
): number[][][] {
  const { appraisers: a, parts: p, trials: n, measurements } = input;
  const grid: (number | undefined)[][][] = Array.from({ length: a }, () =>
    Array.from({ length: p }, () => Array<number | undefined>(n).fill(undefined)),
  );
  for (const m of measurements) {
    if (
      !Number.isInteger(m.appraiser) ||
      m.appraiser < 1 ||
      m.appraiser > a ||
      !Number.isInteger(m.part) ||
      m.part < 1 ||
      m.part > p ||
      !Number.isInteger(m.trial) ||
      m.trial < 1 ||
      m.trial > n
    ) {
      throw new GaugeRrError(
        `Measurement (appraiser ${m.appraiser}, part ${m.part}, trial ${m.trial}) is outside the declared ${a}×${p}×${n} design`,
      );
    }
    grid[m.appraiser - 1]![m.part - 1]![m.trial - 1] = m.value;
  }
  return grid.map((byPart) =>
    byPart.map((trials) => {
      if (trials.some((v) => v === undefined)) {
        throw new GaugeRrError(
          "Study is missing measurements — every appraiser × part × trial cell must be filled before analysis",
        );
      }
      return trials as number[];
    }),
  );
}

/** Explicit if/elif/else, reject checked first — SPRINT-04 M3 AC2. */
export function classifyGaugeRrVerdict(pctStudyVarGrr: number, ndc: number): GaugeRrVerdict {
  if (pctStudyVarGrr >= 30 || ndc < 5) return "reject";
  if (pctStudyVarGrr >= 10) return "acceptable";
  return "excellent";
}

function sourceResult(
  sigma: number,
  totalSigma: number,
  tolerance: number | null,
): GaugeRrSourceResult {
  const studyVariation = sigma * STUDY_VAR_K;
  return {
    stdDev: sigma,
    studyVariation,
    pctStudyVar: totalSigma > 0 ? (100 * sigma) / totalSigma : 0,
    pctTolerance: tolerance != null && tolerance > 0 ? (100 * studyVariation) / tolerance : null,
  };
}

interface FinalizeInput {
  readonly method: MsaMethod;
  readonly sigmaRepeatability: number;
  readonly sigmaAppraiser: number | null;
  readonly sigmaAppraiserByPart: number | null;
  readonly sigmaReproducibility: number;
  readonly sigmaPartToPart: number;
  readonly tolerance: number | null | undefined;
  readonly interactionPooled: boolean | null;
}

/**
 * Shared final stage for both methods: `σ_GRR = √(σ_repeatability² +
 * σ_reproducibility²)`, `σ_total = √(σ_GRR² + σ_part²)`, then %StudyVar,
 * %Tolerance, ndc and the verdict — SPRINT-04 §3.2 "Both methods, shared".
 */
function finalize(p: FinalizeInput): GaugeRrResult {
  const sigmaGrr = Math.sqrt(p.sigmaRepeatability ** 2 + p.sigmaReproducibility ** 2);
  const sigmaTotal = Math.sqrt(sigmaGrr ** 2 + p.sigmaPartToPart ** 2);
  const tolerance = p.tolerance ?? null;

  const repeatability = sourceResult(p.sigmaRepeatability, sigmaTotal, tolerance);
  const reproducibility = sourceResult(p.sigmaReproducibility, sigmaTotal, tolerance);
  const grr = sourceResult(sigmaGrr, sigmaTotal, tolerance);
  const partToPart = sourceResult(p.sigmaPartToPart, sigmaTotal, tolerance);
  const total = sourceResult(sigmaTotal, sigmaTotal, tolerance);
  const appraiser = p.sigmaAppraiser !== null ? sourceResult(p.sigmaAppraiser, sigmaTotal, tolerance) : null;
  const appraiserByPart =
    p.sigmaAppraiserByPart !== null ? sourceResult(p.sigmaAppraiserByPart, sigmaTotal, tolerance) : null;

  // ndc = floor(1.41 × PV/GRR); guarded against ÷0 (a perfect-repeatability,
  // perfect-reproducibility study is a theoretical edge case, not a crash).
  const ndc =
    sigmaGrr > 0
      ? Math.floor(1.41 * (p.sigmaPartToPart / sigmaGrr))
      : p.sigmaPartToPart > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  return {
    method: p.method,
    repeatability,
    appraiser,
    appraiserByPart,
    reproducibility,
    grr,
    partToPart,
    total,
    ndc,
    verdict: classifyGaugeRrVerdict(grr.pctStudyVar, ndc),
    interactionPooled: p.interactionPooled,
  };
}

/**
 * Method 1 — crossed ANOVA (SPRINT-04 §3.2). Minimum 2 appraisers/2 parts/2
 * trials (below that, `(a−1)(p−1)` or `a·p·(n−1)` degrees of freedom hit 0 —
 * M1 AC5's hard floor); the shared upper cap (10/50/10) and the caller's own
 * declared dimensions are the API layer's concern (`packages/types` Zod +
 * `MsaService`), not re-enforced here beyond what the math itself requires.
 */
export function crossedAnovaGaugeRr(input: GaugeRrStudyInput): GaugeRrResult {
  const { appraisers: a, parts: p, trials: n, tolerance } = input;
  if (a < 2 || p < 2 || n < 2) {
    throw new GaugeRrError("crossed_anova needs at least 2 appraisers, 2 parts and 2 trials");
  }
  const grid = groupMeasurements(input); // grid[ai][pi] = trial values, length n

  const cellMean = grid.map((byPart) => byPart.map((trials) => mean(trials)));
  const partMean = Array.from({ length: p }, (_, pi) => mean(grid.map((byPart) => byPart[pi]!).flat()));
  const appraiserMean = grid.map((byPart) => mean(byPart.flat()));
  const grandMean = mean(grid.flat(2));

  const ssPart = n * a * partMean.reduce((sum, m) => sum + (m - grandMean) ** 2, 0);
  const ssAppraiser = n * p * appraiserMean.reduce((sum, m) => sum + (m - grandMean) ** 2, 0);

  let ssInteraction = 0;
  for (let ai = 0; ai < a; ai++) {
    for (let pi = 0; pi < p; pi++) {
      const residual = cellMean[ai]![pi]! - partMean[pi]! - appraiserMean[ai]! + grandMean;
      ssInteraction += residual ** 2;
    }
  }
  ssInteraction *= n;

  let ssEquipment = 0;
  for (let ai = 0; ai < a; ai++) {
    for (let pi = 0; pi < p; pi++) {
      for (const v of grid[ai]![pi]!) ssEquipment += (v - cellMean[ai]![pi]!) ** 2;
    }
  }

  const dfPart = p - 1;
  const dfAppraiser = a - 1;
  const dfInteraction = (a - 1) * (p - 1);
  const dfEquipment = a * p * (n - 1);

  const msPart = ssPart / dfPart;
  const msAppraiser = ssAppraiser / dfAppraiser;
  const msInteraction = ssInteraction / dfInteraction;
  const msEquipment = ssEquipment / dfEquipment;

  // Interaction pooling (fixed AIAG-convention rule, not configurable):
  // SPRINT-04 §3.2 [AMENDED-5], the real published AIAG pooled-MSE
  // convention. When MS_interaction ≤ MS_equipment, the interaction and
  // equipment error terms are merged into one pooled error term, MSE_pooled,
  // which replaces BOTH MS_interaction and MS_equipment in every downstream
  // formula below — repeatability included, not just the appraiser×part
  // term, which is why `msE` (repeatability's error term) and `msSubtractor`
  // (the appraiser/part subtraction's error term) coincide once pooled but
  // differ, as MS_equipment vs MS_interaction, when not pooled.
  const interactionPooled = msInteraction <= msEquipment;
  const msePooled = (ssInteraction + ssEquipment) / (dfInteraction + dfEquipment);
  const msE = interactionPooled ? msePooled : msEquipment;
  const msSubtractor = interactionPooled ? msePooled : msInteraction;

  const sigma2Repeatability = msE;
  const sigma2AppraiserByPart = interactionPooled ? 0 : Math.max(0, (msInteraction - msEquipment) / n);
  const sigma2Appraiser = Math.max(0, (msAppraiser - msSubtractor) / (n * p));
  const sigma2Reproducibility = sigma2Appraiser + sigma2AppraiserByPart;
  const sigma2PartToPart = Math.max(0, (msPart - msSubtractor) / (n * a));

  return finalize({
    method: "crossed_anova",
    sigmaRepeatability: Math.sqrt(sigma2Repeatability),
    sigmaAppraiser: Math.sqrt(sigma2Appraiser),
    sigmaAppraiserByPart: Math.sqrt(sigma2AppraiserByPart),
    sigmaReproducibility: Math.sqrt(sigma2Reproducibility),
    sigmaPartToPart: Math.sqrt(sigma2PartToPart),
    tolerance,
    interactionPooled,
  });
}

/**
 * Method 2 — classic AIAG Average & Range short-form (SPRINT-04 §3.2). Only
 * valid for trials ∈ {2,3}, appraisers ∈ {2,3}, parts ∈ [2,10] — the domain
 * of the published K-tables; anything else throws rather than silently
 * looking up `undefined` (M1 AC4's bound, re-enforced authoritatively in the
 * Zod schema, but the math itself cannot run outside this domain either way).
 */
export function averageRangeGaugeRr(input: GaugeRrStudyInput): GaugeRrResult {
  const { appraisers: a, parts: p, trials: n, tolerance } = input;
  const k1 = K1_TABLE[n];
  const k2 = K2_TABLE[a];
  const k3 = K3_TABLE[p];
  if (k1 === undefined || k2 === undefined || k3 === undefined) {
    throw new GaugeRrError(
      `average_range needs trials in {2,3}, appraisers in {2,3}, parts in 2-10 (got ${a} appraisers × ${p} parts × ${n} trials)`,
    );
  }
  const grid = groupMeasurements(input); // grid[ai][pi] = trial values, length n

  const cellRange = grid.map((byPart) => byPart.map((trials) => Math.max(...trials) - Math.min(...trials)));
  const appraiserRangeMean = cellRange.map((byPart) => mean(byPart)); // R̄_a
  const rBar = mean(appraiserRangeMean); // R̄

  const appraiserMean = grid.map((byPart) => mean(byPart.flat())); // X̄_a
  const xBarDiff = Math.max(...appraiserMean) - Math.min(...appraiserMean);

  const partMean = Array.from({ length: p }, (_, pi) => mean(grid.map((byPart) => byPart[pi]!).flat())); // X̄_p
  const rP = Math.max(...partMean) - Math.min(...partMean);

  const ev = rBar * k1;
  const avSquared = (xBarDiff * k2) ** 2 - ev ** 2 / (p * n);
  const av = Math.sqrt(Math.max(0, avSquared));
  const pv = rP * k3;

  // EV/AV/PV above are already the classic AIAG "study variation" (≈5.15σ)
  // quantities; dividing by STUDY_VAR_K here recovers the raw σ so {@link
  // finalize} can re-apply the shared ×5.15 step identically for both
  // methods (SPRINT-04 §3.2 "Both methods, shared" — the multiplier cancels
  // out of every ratio, %StudyVar and ndc alike, so this is bookkeeping, not
  // a second independent choice of constant).
  return finalize({
    method: "average_range",
    sigmaRepeatability: ev / STUDY_VAR_K,
    sigmaAppraiser: null,
    sigmaAppraiserByPart: null,
    sigmaReproducibility: av / STUDY_VAR_K,
    sigmaPartToPart: pv / STUDY_VAR_K,
    tolerance,
    interactionPooled: null,
  });
}

export function analyzeGaugeRr(input: GaugeRrStudyInput & { readonly method: MsaMethod }): GaugeRrResult {
  return input.method === "crossed_anova" ? crossedAnovaGaugeRr(input) : averageRangeGaugeRr(input);
}
