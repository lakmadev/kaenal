/**
 * FMEA scoring (04 §FMEA workbench; AIAG/VDA harmonized PFMEA/DFMEA).
 *
 * Each failure mode carries three 1–10 ratings — Severity (S), Occurrence (O),
 * Detection (D) — and derives two things from them:
 *
 *  - **RPN** = S × O × D (1–1000), the classic risk-priority number.
 *  - **Action Priority (AP)** = High / Medium / Low, the AIAG/VDA replacement
 *    for RPN thresholds.
 *
 * The AP here is the SIMPLIFIED rule the design states in its own UI note
 * ("Severity 9–10 with Occ ≥ 2 → High; Severity 7–8 with Occ × Det ≥ 6 → High;
 * others mapped per AIAG/VDA table"), plus an RPN-banded Medium/Low split. The
 * full certified AIAG/VDA 2019 (S,O,D) lookup table is a follow-up (flagged in
 * TODO) — encoding it wrong would be worse than clearly labelling this as the
 * documented approximation. Everything here is pure and unit-tested.
 */

export type FmeaRating = number; // 1–10
export type ActionPriority = "H" | "M" | "L";

const clampRating = (n: number): number => Math.min(10, Math.max(1, Math.round(n)));

/** Risk Priority Number: S × O × D, each clamped to 1–10 (so 1–1000). */
export function rpn(severity: FmeaRating, occurrence: FmeaRating, detection: FmeaRating): number {
  return clampRating(severity) * clampRating(occurrence) * clampRating(detection);
}

/** RPN at or above which a documented Medium action is warranted (classic threshold). */
export const RPN_ACTION_THRESHOLD = 100;

/**
 * Action Priority for one failure mode. High follows the two rules the design
 * states; a 9–10 severity that misses High, or an RPN ≥ {@link RPN_ACTION_THRESHOLD},
 * is Medium; everything else is Low. Severity 1 (no discernible effect) is always
 * Low, matching AIAG/VDA.
 */
export function actionPriority(
  severity: FmeaRating,
  occurrence: FmeaRating,
  detection: FmeaRating,
): ActionPriority {
  const s = clampRating(severity);
  const o = clampRating(occurrence);
  const d = clampRating(detection);

  if (s <= 1) return "L";
  if (s >= 9 && o >= 2) return "H";
  if (s >= 7 && o * d >= 6) return "H";
  if (s >= 9 || s * o * d >= RPN_ACTION_THRESHOLD) return "M";
  return "L";
}

/** Count of failure modes at each Action Priority — drives the distribution card. */
export interface ApDistribution {
  H: number;
  M: number;
  L: number;
}

export function apDistribution(
  items: readonly { severity: FmeaRating; occurrence: FmeaRating; detection: FmeaRating }[],
): ApDistribution {
  const dist: ApDistribution = { H: 0, M: 0, L: 0 };
  for (const it of items) dist[actionPriority(it.severity, it.occurrence, it.detection)] += 1;
  return dist;
}
