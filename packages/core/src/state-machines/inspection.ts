import type { InspectionStatus } from "@kaenal/types";
import { allow, deny } from "../result.js";
import { defineMachine, type Guard, type TransitionMap } from "./machine.js";

/**
 * Inspection lifecycle (02 §4):
 *   scheduled → in_progress → completed
 *   scheduled | in_progress → cancelled
 */
const INSPECTION_TRANSITIONS: TransitionMap<InspectionStatus> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export interface InspectionTransitionContext {
  /** Item ids the template marks `required`, for the pinned template version. */
  readonly requiredItemIds: readonly string[];
  /** Item ids that actually carry an answer in `responses`. */
  readonly answeredItemIds: readonly string[];
}

/**
 * Completion requires every required item answered, validated server-side
 * against the template schema (02 §4) — the mobile client validates too, but
 * an offline queue replay or a direct API call must not be able to complete a
 * half-filled inspection.
 */
const requiresAllRequiredItemsAnswered: Guard<InspectionStatus, InspectionTransitionContext> = (
  ctx,
  _from,
  to,
) => {
  if (to !== "completed") return allow();

  const answered = new Set(ctx.answeredItemIds);
  const missing = ctx.requiredItemIds.filter((id) => !answered.has(id));

  if (missing.length > 0) {
    return deny(
      "VALIDATION_FAILED",
      `Cannot complete: ${missing.length} required item(s) unanswered`,
      { missingItemIds: missing },
    );
  }
  return allow();
};

export const inspectionMachine = defineMachine<InspectionStatus, InspectionTransitionContext>({
  transitions: INSPECTION_TRANSITIONS,
  guards: [requiresAllRequiredItemsAnswered],
});
