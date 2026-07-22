import type { EightDStepStatus } from "@kaenal/types";
import { allow, deny, type Decision } from "./result.js";

/**
 * 8D step gating (02 §4). The eight disciplines run mostly in order — a step
 * can only be marked complete once its prerequisites are — with ONE specified
 * exception: D3 (interim containment) may run parallel to D2 (problem
 * description), so completing D3 does not wait on D2. This lives in core as a
 * pure function so the rule has one home, exercised by the API and testable
 * without a database.
 */

export const EIGHT_D_STEPS = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"] as const;
export type EightDStep = (typeof EIGHT_D_STEPS)[number];

export type StepStatuses = Partial<Record<EightDStep, EightDStepStatus>>;

export function stepKey(n: number): EightDStep {
  return `d${n}` as EightDStep;
}

/**
 * The steps that must be `complete` before step N may be completed. Strictly
 * 1..N-1, minus the D2→D3 dependency: D3 may be completed while D2 is still in
 * progress (they run in parallel), so D3's only prerequisite is D1.
 */
export function prerequisitesFor(n: number): number[] {
  const prereqs: number[] = [];
  for (let i = 1; i < n; i += 1) {
    if (n === 3 && i === 2) continue; // D3 ∥ D2
    prereqs.push(i);
  }
  return prereqs;
}

/** Whether step N may be marked `complete` given the current step statuses. */
export function canCompleteStep(n: number, statuses: StepStatuses): Decision {
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    return deny("VALIDATION_FAILED", `Unknown 8D step D${n}`, { steps: EIGHT_D_STEPS });
  }

  const missing = prerequisitesFor(n).filter((p) => statuses[stepKey(p)] !== "complete");
  if (missing.length > 0) {
    return deny(
      "INVALID_TRANSITION",
      `D${n} cannot be completed until ${missing.map((m) => `D${m}`).join(", ")} ${missing.length === 1 ? "is" : "are"} complete`,
      { blockedBy: missing.map(stepKey), requires: prerequisitesFor(n).map(stepKey) },
    );
  }
  return allow();
}

/** All eight disciplines complete — the precondition for closing an 8D. */
export function allStepsComplete(statuses: StepStatuses): boolean {
  return EIGHT_D_STEPS.every((step) => statuses[step] === "complete");
}

/** A fresh 8D: every discipline pending. */
export function initialStepStatuses(): Record<EightDStep, EightDStepStatus> {
  const out = {} as Record<EightDStep, EightDStepStatus>;
  for (const step of EIGHT_D_STEPS) out[step] = "pending";
  return out;
}
