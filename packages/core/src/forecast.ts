/**
 * Predictive risk — v1 statistical baseline (Sprint 03 Part B, §3B, user-
 * approved 2026-09-28). Pure functions — no DB — so the trend/band/confidence
 * math is unit-testable against a hand-computed reference series, mirroring
 * `spc.ts`/`fmea.ts`'s "tested vs a worked example" precedent.
 *
 * Deliberately NOT a machine-learning model: an ordinary-least-squares linear
 * trend over each subject's own trailing 6 periods of NC-volume counts, plus a
 * fixed-width confidence band and a deterministic confidence score derived
 * from the trend's own R² and history length. §3B is explicit that the jsx's
 * "v3 gradient-boosted / 91% backtested" model-banner copy is aspirational
 * fiction this sprint does not reproduce — this module is the real v1.
 */

export const FORECAST_MODEL_VERSION = "nc-forecast-v1-baseline";

/** The 3 horizon rows computed per subject per job run (jsx: month/quarter/2Q). */
export const FORECAST_HORIZON_KINDS = ["month", "quarter", "half"] as const;
export type ForecastHorizonKind = (typeof FORECAST_HORIZON_KINDS)[number];

/** How many periods (months) ahead of the trailing series each horizon targets. */
const PERIODS_AHEAD: Readonly<Record<ForecastHorizonKind, number>> = {
  month: 1,
  quarter: 3,
  half: 6,
};

/** A subject needs at least this many of its last 6 periods with ≥1 NCR. */
export const MIN_HISTORY_PERIODS_WITH_DATA = 4;
export const HISTORY_LENGTH = 6;

/** ≈80% band under a normal-error assumption (z ≈ 1.28), widened by √(periods ahead). */
const BAND_Z = 1.28;

export interface OlsFit {
  readonly slope: number;
  readonly intercept: number;
  /** Coefficient of determination, 0–1 (0 when the series is flat/degenerate). */
  readonly r2: number;
  readonly residualStdDev: number;
}

/**
 * Ordinary least-squares fit of `values` against their index (0..n-1). Used
 * both for the point forecast and for R²/residual-based confidence + band
 * width. Degenerate series (n < 2, or zero variance) return a flat fit with
 * r2 = 0 rather than throwing — the caller's minimum-history gate is what
 * decides whether a fit is trustworthy enough to score at all.
 */
export function olsFit(values: readonly number[]): OlsFit {
  const n = values.length;
  if (n < 2) {
    const only = values[0] ?? 0;
    return { slope: 0, intercept: only, r2: 0, residualStdDev: 0 };
  }

  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - xMean;
    sxy += dx * (values[i]! - yMean);
    sxx += dx * dx;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i]! + intercept;
    ssRes += (values[i]! - predicted) ** 2;
    ssTot += (values[i]! - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
  const residualStdDev = Math.sqrt(ssRes / n);

  return { slope, intercept, r2, residualStdDev };
}

/**
 * Point forecast `periodsAhead` beyond the last index of `history`, floored
 * at 0 (an NC count cannot be negative).
 */
export function trendForecast(history: readonly number[], periodsAhead: number, fit: OlsFit = olsFit(history)): number {
  const nextIndex = history.length - 1 + periodsAhead;
  return Math.max(0, fit.slope * nextIndex + fit.intercept);
}

/** Band half-width at `periodsAhead`, widening with distance (§3B). */
export function bandHalfWidth(fit: OlsFit, periodsAhead: number): number {
  return fit.residualStdDev * BAND_Z * Math.sqrt(Math.max(1, periodsAhead));
}

/**
 * Confidence 0–100: a deterministic function of the trend's R² and how much
 * history backs it — not a separately-tuned "ML confidence" (§3B). A clean,
 * fully-populated 6-period trend can reach 100; a noisy or short series caps
 * out lower even with a decent R².
 */
export function confidenceFromFit(fit: OlsFit, periodsOfData: number): number {
  const historyFactor = Math.min(1, periodsOfData / HISTORY_LENGTH);
  const raw = fit.r2 * 100 * historyFactor;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

/** True when ≥ MIN_HISTORY_PERIODS_WITH_DATA of the last 6 periods have ≥1 NCR. */
export function hasMinimumHistory(history: readonly number[]): boolean {
  if (history.length < HISTORY_LENGTH) return false;
  const withData = history.filter((v) => v >= 1).length;
  return withData >= MIN_HISTORY_PERIODS_WITH_DATA;
}

export type RiskLevel = "critical" | "high" | "medium" | "low";

/**
 * Risk-level buckets (§3B, Q21 — first cut, not yet validated against live
 * tenant distributions): critical ≥2× trailing average AND confidence ≥60;
 * high ≥1.5×; medium ≥1.1×; else low. `trailingAverage` of 0 (a subject with
 * an all-zero-but-still-minimum-history series) can never clear any
 * multiplier-based threshold, so it is always `low` — never a divide-by-zero.
 */
export function riskLevel(predictedValue: number, trailingAverage: number, confidence: number): RiskLevel {
  if (trailingAverage <= 0) return "low";
  const ratio = predictedValue / trailingAverage;
  if (ratio >= 2 && confidence >= 60) return "critical";
  if (ratio >= 1.5) return "high";
  if (ratio >= 1.1) return "medium";
  return "low";
}

export function trailingAverage(history: readonly number[]): number {
  if (history.length === 0) return 0;
  return history.reduce((a, b) => a + b, 0) / history.length;
}

/**
 * Short deterministic driver sentence (§3B) — never the jsx's invented
 * domain narratives (SPC/HR data this sprint doesn't wire in).
 */
export function forecastReasoning(history: readonly number[]): string {
  const first = history[0];
  const last = history[history.length - 1];
  if (first === undefined || last === undefined || history.length < 2) {
    return "Not enough history to describe a trend.";
  }
  if (last > first) return `NC count rose ${first}→${last} over ${history.length} periods`;
  if (last < first) return `NC count fell ${first}→${last} over ${history.length} periods`;
  return `NC count held steady at ${last} over ${history.length} periods`;
}

/**
 * Calendar-period label for a horizon kind, `periodsAhead` months from `now`
 * (§3B: e.g. '2026-Q4'). Month: 'YYYY-MM'. Quarter: the calendar quarter
 * containing the target month, 'YYYY-Qn'. Half: the calendar half-year
 * containing the target month, 'YYYY-Hn' (H1 = Jan–Jun, H2 = Jul–Dec) — the
 * smallest reasonable, deterministic reading of the jsx's "next month / next
 * quarter / next 2Q" selector (logged in PROGRESS.md Decisions log).
 */
export function horizonLabel(kind: ForecastHorizonKind, now: Date): string {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + PERIODS_AHEAD[kind], 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth(); // 0-indexed
  if (kind === "month") return `${year}-${String(month + 1).padStart(2, "0")}`;
  if (kind === "quarter") return `${year}-Q${Math.floor(month / 3) + 1}`;
  return `${year}-H${month < 6 ? 1 : 2}`;
}

export interface ForecastPoint {
  readonly horizon: string;
  readonly horizonKind: ForecastHorizonKind;
  readonly predictedValue: number;
  readonly confidence: number;
  readonly bandLow: number;
  readonly bandHigh: number;
  readonly reasoning: string;
}

export interface ForecastResult {
  readonly points: readonly ForecastPoint[];
  readonly trailingAverage: number;
}

/**
 * Full v1 forecast for one subject: 3 horizon points (month/quarter/half)
 * from one trailing-6-period history. Returns `null` when the subject does
 * not clear the minimum-history gate (§3B) — the caller writes no row for it.
 */
export function computeForecast(history: readonly number[], now: Date = new Date()): ForecastResult | null {
  if (!hasMinimumHistory(history)) return null;

  const fit = olsFit(history);
  const avg = trailingAverage(history);
  const reasoning = forecastReasoning(history);

  const points: ForecastPoint[] = FORECAST_HORIZON_KINDS.map((kind) => {
    const periodsAhead = PERIODS_AHEAD[kind];
    const predicted = trendForecast(history, periodsAhead, fit);
    const half = bandHalfWidth(fit, periodsAhead);
    const confidence = confidenceFromFit(fit, history.length);
    return {
      horizon: horizonLabel(kind, now),
      horizonKind: kind,
      predictedValue: Math.round(predicted * 100) / 100,
      confidence,
      bandLow: Math.max(0, Math.round((predicted - half) * 100) / 100),
      bandHigh: Math.round((predicted + half) * 100) / 100,
      reasoning,
    };
  });

  return { points, trailingAverage: avg };
}

// --- P6: PPAP deadline-risk scoring (reuses the same job, a sibling scorer) --

export interface PpapRiskInput {
  readonly submittedDate: string | null;
  readonly dueDate: string | null;
  /** 0–1, from `ppapCompleteness` (approved ÷ required). */
  readonly completionRate: number;
  readonly now?: Date;
}

export interface PpapRiskScore {
  readonly confidence: number;
  readonly willMissDeadline: boolean;
  readonly daysLikelyOver: number | null;
  readonly reasoning: string;
}

/**
 * Deterministic PPAP deadline-risk score (§2B P6) — projects the completion
 * rate forward at its current pace against the days remaining to `dueDate`.
 * Returns `null` (→ `{}`, no prediction) when there isn't enough to project
 * from: no due date, or no submitted date to measure pace against.
 */
export function ppapRiskScore(input: PpapRiskInput): PpapRiskScore | null {
  if (input.dueDate === null || input.submittedDate === null) return null;
  const now = input.now ?? new Date();
  const submitted = new Date(input.submittedDate).getTime();
  const due = new Date(input.dueDate).getTime();
  if (Number.isNaN(submitted) || Number.isNaN(due)) return null;

  const daysOpen = Math.max(1, Math.round((now.getTime() - submitted) / 86_400_000));
  const pace = input.completionRate / daysOpen; // completion fraction per day, at the observed rate
  const daysToComplete = pace > 0 ? (1 - input.completionRate) / pace : Number.POSITIVE_INFINITY;
  const daysRemaining = Math.round((due - now.getTime()) / 86_400_000);

  const willMissDeadline = daysToComplete > daysRemaining;
  const daysLikelyOver = willMissDeadline
    ? Math.max(0, Math.round(daysToComplete - daysRemaining))
    : null;

  // Confidence rises with how far into the package we are — an early-stage
  // submission's pace is a much noisier predictor than a near-complete one.
  const confidence = Math.round(Math.min(95, 40 + input.completionRate * 55));

  const reasoning =
    input.completionRate <= 0
      ? "No elements approved yet — pace cannot be projected."
      : willMissDeadline
        ? `At current pace (${Math.round(input.completionRate * 100)}% in ${daysOpen}d), completion trails the due date by ~${daysLikelyOver ?? 0}d.`
        : `At current pace (${Math.round(input.completionRate * 100)}% in ${daysOpen}d), on track to complete by the due date.`;

  return { confidence, willMissDeadline, daysLikelyOver, reasoning };
}
