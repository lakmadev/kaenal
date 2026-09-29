/**
 * Risk register 5×5 matrix math (SPRINT-04 R1; `qms-risk-spc.jsx:16-224`).
 *
 * Pure functions — no DB — mirroring `fmea.ts`'s "pure scoring logic" style:
 * a score band and the heat-map cell-count grid that both the register's
 * matrix and its click-to-filter interaction read.
 */

export type RiskScoreBand = "low" | "medium" | "high" | "critical";

/**
 * Score band for a likelihood×impact (or residual) score, 1–25. Thresholds are
 * the jsx's own (`qms-risk-spc.jsx:63`), approved in SPRINT-04 §3.1 as
 * non-negotiable: critical ≥16, high ≥10, medium ≥6, low otherwise.
 */
export function scoreBand(score: number): RiskScoreBand {
  if (score >= 16) return "critical";
  if (score >= 10) return "high";
  if (score >= 6) return "medium";
  return "low";
}

export interface RiskMatrixPoint {
  readonly likelihood: number; // 1–5
  readonly impact: number; // 1–5
}

/**
 * 5×5 heat-map cell counts, indexed `[likelihood-1][impact-1]` (both 1–5).
 * Drives the register's heat map and its "click a cell to filter the
 * register" interaction (SPRINT-04 R1 AC2) — a risk outside the valid 1–5
 * range on either axis is silently excluded rather than throwing, since the
 * DB's own CHECK constraints (R1 AC1) are what actually enforce that bound;
 * this function only tabulates what a valid register already contains.
 */
export function matrixCounts(risks: readonly RiskMatrixPoint[]): number[][] {
  const grid: number[][] = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  for (const r of risks) {
    if (!Number.isInteger(r.likelihood) || !Number.isInteger(r.impact)) continue;
    if (r.likelihood < 1 || r.likelihood > 5 || r.impact < 1 || r.impact > 5) continue;
    const row = grid[r.likelihood - 1]!;
    row[r.impact - 1] = (row[r.impact - 1] ?? 0) + 1;
  }
  return grid;
}
