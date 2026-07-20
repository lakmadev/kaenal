import type { NcrActionKind, NcrActionStatus, NcrStatus, Role } from "@kaenal/types";
import { allow, deny } from "../result.js";
import { defineMachine, type Guard, type TransitionMap } from "./machine.js";

/**
 * NCR lifecycle (02 §4):
 *   draft → open → assigned → in_progress → resolved → verified → closed
 *   any active state → escalated (automatically on SLA breach, or manually)
 *   closed → reopened → in_progress
 */

/** Every state an NCR can escalate out of — i.e. everything still in play. */
const ACTIVE_STATES = [
  "draft",
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "verified",
  "reopened",
] as const satisfies readonly NcrStatus[];

const NCR_TRANSITIONS: TransitionMap<NcrStatus> = {
  draft: ["open", "escalated"],
  open: ["assigned", "escalated"],
  assigned: ["in_progress", "escalated"],
  in_progress: ["resolved", "escalated"],
  // Verification can bounce work back rather than forcing a close-and-reopen.
  resolved: ["verified", "in_progress", "escalated"],
  verified: ["closed", "escalated"],
  closed: ["reopened"],
  // Escalation is a flag on a live NCR, not a dead end: it returns to the
  // normal flow once someone picks it up.
  escalated: ["assigned", "in_progress", "resolved"],
  reopened: ["in_progress", "escalated"],
};

export interface NcrAction {
  readonly kind: NcrActionKind;
  readonly status: NcrActionStatus;
}

export interface NcrTransitionContext {
  /** Actions currently attached to the NCR. */
  readonly actions: readonly NcrAction[];
  /** Who is performing this transition. */
  readonly actorId: string;
  readonly actorRole: Role;
  /** Who moved it to `resolved`, if anyone has. Drives the four-eyes rule. */
  readonly resolvedBy?: string | null;
  /** Id of a linked 8D that is still open, if any. Blocks closing (03 §10). */
  readonly openEightDId?: string | null;
  /** Manager override for the 8D block. Audited by the caller. */
  readonly force?: boolean;
}

/**
 * Resolving requires real containment: at least one corrective action marked
 * done. Without this an NCR can be resolved with an empty action list, which
 * is exactly the audit finding this system exists to prevent.
 */
const requiresCompletedCorrectiveAction: Guard<NcrStatus, NcrTransitionContext> = (ctx, _from, to) => {
  if (to !== "resolved") return allow();

  const done = ctx.actions.filter(
    (a) => a.kind === "corrective" && (a.status === "done" || a.status === "verified"),
  );

  if (done.length === 0) {
    return deny(
      "INVALID_TRANSITION",
      "An NCR cannot be resolved until at least one corrective action is done",
      { requires: "corrective_action_done", correctiveActions: ctx.actions.length },
    );
  }
  return allow();
};

/**
 * Four-eyes (02 §4): the person who resolved an NCR cannot be the one who
 * verifies it. Also enforced as a DB CHECK (`ncrs_four_eyes_ck`) so no path —
 * job, sync replay, support tool — can bypass it; this guard exists to return
 * a comprehensible 409 instead of a constraint violation.
 */
const requiresFourEyes: Guard<NcrStatus, NcrTransitionContext> = (ctx, _from, to) => {
  if (to !== "verified") return allow();

  if (ctx.resolvedBy != null && ctx.resolvedBy === ctx.actorId) {
    return deny(
      "INVALID_TRANSITION",
      "The person who resolved an NCR cannot verify it — verification needs a second pair of eyes",
      { requires: "four_eyes", resolvedBy: ctx.resolvedBy },
    );
  }
  return allow();
};

/**
 * Closing an NCR with a live 8D attached hides unfinished problem-solving
 * behind a closed record (03 §10). Managers may override; the caller is
 * responsible for writing the audit event with a reason.
 */
const blockedByOpenEightD: Guard<NcrStatus, NcrTransitionContext> = (ctx, _from, to) => {
  if (to !== "closed") return allow();
  if (ctx.openEightDId == null) return allow();

  if (ctx.force === true) {
    if (ctx.actorRole === "admin" || ctx.actorRole === "manager") return allow();
    return deny("FORBIDDEN", "Only an admin or manager can force-close an NCR with an open 8D", {
      requiredRole: ["admin", "manager"],
      blockedBy: ctx.openEightDId,
    });
  }

  return deny("CONFLICT", "This NCR has an open 8D and cannot be closed", {
    blockedBy: ctx.openEightDId,
    override: "Set force=true as an admin or manager to close anyway",
  });
};

export const ncrMachine = defineMachine<NcrStatus, NcrTransitionContext>({
  transitions: NCR_TRANSITIONS,
  guards: [requiresCompletedCorrectiveAction, requiresFourEyes, blockedByOpenEightD],
});

export const NCR_ACTIVE_STATES: readonly NcrStatus[] = ACTIVE_STATES;

/** True while the NCR still counts against SLA and dashboards. */
export function isNcrActive(status: NcrStatus): boolean {
  return status !== "closed";
}
