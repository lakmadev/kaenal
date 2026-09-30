import type { EcnStage, Role } from "@kaenal/types";
import { allow, deny } from "../result.js";
import { defineMachine, type Guard, type TransitionMap } from "./machine.js";

/**
 * ECN lifecycle (SPRINT-06 §3.2, §0b D1/D3) — a genuinely multi-stage
 * approval machine, unlike `documentMachine`'s single `draft → pending →
 * approved|rejected` shape. This is NOT documentMachine extended; it is its
 * own machine that reuses the same shape (`defineMachine`, a role-gated
 * four-eyes guard, forward-only transitions with one named backward edge).
 *
 * Canonical pipeline (7 ordered stages, `ppap` a real 5th approval gate
 * placed between `risk_review` and `cab_approval`, §0b D1):
 *
 *   draft → feasibility → risk_review → ppap → cab_approval → pilot →
 *   implementation → closed
 *
 * Every pre-`implementation` stage can move to the terminal `rejected`
 * state instead of advancing, and `rejected` itself can move back to
 * `draft` via resubmission (§0b D3) — modelled directly on
 * `documentMachine`'s own real `rejected → draft` transition, no additional
 * guard, matching that precedent's own unguarded shape exactly.
 *
 * Every transition has a named, callable route, never one generic "approve"
 * call (§0 B1/§0b D3):
 *   - `draft → feasibility`     — `POST /v1/ecns/:id/submit`      (ecn:manage)
 *   - `draft → rejected`        — `POST /v1/ecns/:id/withdraw`    (ecn:manage)
 *   - `rejected → draft`        — `POST /v1/ecns/:id/resubmit`    (ecn:manage)
 *   - 5 gated stages → next|rejected — `POST /v1/ecns/:id/approvals/:stage`
 *                                                                 (ecn:approve)
 *   - `implementation → closed` — `POST /v1/ecns/:id/close`       (ecn:manage)
 *
 * This module only answers "is this transition legal" — the service layer
 * (pre-creating `ecn_approvals` rows, running E5's auto-revise on
 * `pilot → implementation`, persisting `auto_revise_result`, writing audit
 * events) lives in `apps/api`, exactly mirroring `document.ts`'s own division
 * of responsibility.
 */

/** The 7 ordered pipeline stages — `closed`/`rejected` are terminal/backward
 *  outcomes, excluded from the "step X of 7" count (§2 E1 AC2). */
export const ECN_STAGE_ORDER: readonly EcnStage[] = [
  "draft",
  "feasibility",
  "risk_review",
  "ppap",
  "cab_approval",
  "pilot",
  "implementation",
];

/** The 5 human-approval gates, each backed by its own `ecn_approvals` row
 *  (§2 E4 AC1, §0b D1 adds `ppap`). */
export const ECN_GATED_STAGES: readonly EcnStage[] = [
  "feasibility",
  "risk_review",
  "ppap",
  "cab_approval",
  "pilot",
];

const GATED_STAGE_SET = new Set(ECN_GATED_STAGES);

/** True for exactly the 5 stages whose forward/reject move is an
 *  admin/manager, four-eyes-guarded approval decision (E4) — false for
 *  `draft`/`implementation`/`closed`/`rejected`, whose own transitions are
 *  plain author/manage-driven lifecycle actions (submit/withdraw/close/
 *  resubmit, §0 B2). */
export function isEcnGatedStage(stage: EcnStage): boolean {
  return GATED_STAGE_SET.has(stage);
}

/**
 * 1-7 for the 7 ordered pipeline stages, `null` for the two outcomes
 * (`closed`/`rejected`) that sit outside the "step X of 7" progress bar
 * (§2 E1 AC2).
 */
export function ecnStageIndex(stage: EcnStage): number | null {
  const index = ECN_STAGE_ORDER.indexOf(stage);
  return index === -1 ? null : index + 1;
}

const ECN_TRANSITIONS: TransitionMap<EcnStage> = {
  draft: ["feasibility", "rejected"],
  feasibility: ["risk_review", "rejected"],
  risk_review: ["ppap", "rejected"],
  ppap: ["cab_approval", "rejected"],
  cab_approval: ["pilot", "rejected"],
  pilot: ["implementation", "rejected"],
  implementation: ["closed"],
  closed: [],
  // Resubmission (§0b D3) — unguarded, mirroring documentMachine's own
  // `rejected: ["draft"]` entry exactly (document.ts:17).
  rejected: ["draft"],
};

export interface EcnTransitionContext {
  readonly actorId: string;
  readonly actorRole: Role;
  readonly ownerId: string;
  /** Nullable standard audit column — `created_by` (0001_core.sql:33-34). */
  readonly createdById: string | null;
}

/**
 * Only an admin or manager may decide one of the 5 gated stages (§3.2,
 * mirrors `documentMachine`'s `requiresApproverRole`, fixed and uniform —
 * P19's "fixed vs configurable" resolved as fixed, Q30). Every other
 * transition out of `draft`/`implementation`/`rejected` (submit, withdraw,
 * close, resubmit) is a plain `ecn:manage` lifecycle action this guard does
 * not touch — the capability check for those lives in the API route, not
 * here, exactly as documentMachine leaves `document:manage` to its own route.
 */
const requiresApproverRole: Guard<EcnStage, EcnTransitionContext> = (ctx, from) => {
  if (!isEcnGatedStage(from)) return allow();

  if (ctx.actorRole !== "admin" && ctx.actorRole !== "manager") {
    return deny("FORBIDDEN", "Only an admin or manager can approve or reject an ECN stage", {
      capability: "ecn:approve",
      requiredRole: ["admin", "manager"],
    });
  }
  return allow();
};

/**
 * Four-eyes, made explicitly STRICTER than `documentMachine`'s own
 * `forbidsSelfApproval` (§0 B2) — the approved 2026-09-30 version claimed
 * this "mirrors documentMachine exactly", which reading `document.ts:44-54`
 * in full disproves: that guard only blocks self-*approval*, never self-
 * *rejection*. Here, the deciding actor must be neither the ECN's `owner`
 * nor its `created_by`, checked for BOTH approve and reject — a deliberate,
 * stated ECN-specific divergence, not a claimed exact mirror. Applies only
 * to a gated-stage decision; `resubmit` (`rejected → draft`) carries no such
 * guard at all (§0b D3a), matching documentMachine's own unguarded
 * `rejected → draft` precedent.
 */
const forbidsSelfDecision: Guard<EcnStage, EcnTransitionContext> = (ctx, from) => {
  if (!isEcnGatedStage(from)) return allow();

  if (ctx.ownerId === ctx.actorId || (ctx.createdById !== null && ctx.createdById === ctx.actorId)) {
    return deny("FORBIDDEN", "An ECN cannot be approved or rejected by its own owner or creator", {
      requires: "four_eyes",
    });
  }
  return allow();
};

export const ecnMachine = defineMachine<EcnStage, EcnTransitionContext>({
  transitions: ECN_TRANSITIONS,
  guards: [requiresApproverRole, forbidsSelfDecision],
});
