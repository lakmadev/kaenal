/**
 * Supplier scorecard weighting (FEATURES §11.1, P08).
 *
 * The `suppliers.scorecard` column stores RAW KPI metrics only; the weighted
 * score lives here so the weighting is testable and versionable rather than
 * baked into a query or the UI (0001's design note, and CLAUDE.md rule 5 — no
 * business logic in components). The weights are a caller input (the Tweaks
 * panel exposes PPM/OTD/OQE/SCAR sliders), so the same supplier can be scored
 * under different weightings without a write.
 *
 * Every KPI is normalised to a 0–100 "goodness" first, so metrics measured in
 * different units and directions (PPM lower-is-better, OTD higher-is-better)
 * combine meaningfully. A raw-material supplier with no PPM is scored on the
 * metrics it does have — the weights of absent metrics are dropped, not zeroed,
 * so a missing KPI never drags the score to nothing.
 */

export interface SupplierMetrics {
  readonly ppm?: number | null | undefined;
  readonly ppmTarget?: number | null | undefined;
  readonly otd?: number | null | undefined;
  readonly otdTarget?: number | null | undefined;
  readonly oqe?: number | null | undefined;
  readonly oqeTarget?: number | null | undefined;
  readonly scarHours?: number | null | undefined;
  readonly scarTarget?: number | null | undefined;
}

export interface ScoreWeights {
  readonly ppm: number;
  readonly otd: number;
  readonly oqe: number;
  readonly scar: number;
}

/** Default weighting (03 §11.1 / prototype Tweaks panel defaults). */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = { ppm: 0.4, otd: 0.3, oqe: 0.2, scar: 0.1 };

export type SupplierGrade = "A" | "B" | "C" | "D";

export interface SupplierScore {
  /** 0–100, higher is better. */
  readonly score: number;
  readonly grade: SupplierGrade;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

/** Lower actual is better (PPM, SCAR response hours). At/under target = 100. */
function lowerIsBetter(actual: number, target: number): number {
  if (target <= 0) return actual <= 0 ? 100 : 0; // a zero target means "any defect is a miss"
  if (actual <= 0) return 100;
  return clamp((target / actual) * 100, 0, 100);
}

/** Higher actual is better (OTD %, OQE). At/over target = 100. */
function higherIsBetter(actual: number, target: number): number {
  if (target <= 0) return clamp(actual, 0, 100);
  return clamp((actual / target) * 100, 0, 100);
}

const present = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * The weighted 0–100 score for a supplier under the given weights. Returns 0
 * when no metric is present (an unscored supplier), which the caller can render
 * as "—" rather than a real zero.
 */
export function weightedSupplierScore(
  metrics: SupplierMetrics,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): number {
  const components: Array<{ weight: number; value: number }> = [];

  if (present(metrics.ppm) && present(metrics.ppmTarget)) {
    components.push({ weight: weights.ppm, value: lowerIsBetter(metrics.ppm, metrics.ppmTarget) });
  }
  if (present(metrics.otd) && present(metrics.otdTarget)) {
    components.push({ weight: weights.otd, value: higherIsBetter(metrics.otd, metrics.otdTarget) });
  }
  if (present(metrics.oqe) && present(metrics.oqeTarget)) {
    components.push({ weight: weights.oqe, value: higherIsBetter(metrics.oqe, metrics.oqeTarget) });
  }
  if (present(metrics.scarHours) && present(metrics.scarTarget)) {
    components.push({ weight: weights.scar, value: lowerIsBetter(metrics.scarHours, metrics.scarTarget) });
  }

  const totalWeight = components.reduce((sum, c) => sum + Math.max(c.weight, 0), 0);
  if (totalWeight <= 0) return 0;

  const weighted = components.reduce((sum, c) => sum + Math.max(c.weight, 0) * c.value, 0);
  return Math.round(weighted / totalWeight);
}

/** Grade bands: A ≥ 90, B ≥ 75, C ≥ 60, else D. */
export function supplierGrade(score: number): SupplierGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

export function scoreSupplier(
  metrics: SupplierMetrics,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): SupplierScore {
  const score = weightedSupplierScore(metrics, weights);
  return { score, grade: supplierGrade(score) };
}
