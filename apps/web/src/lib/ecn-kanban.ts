import type { EcnStage } from "@kaenal/types";
import { ECN_GATED_STAGES, ECN_STAGE_ORDER } from "@kaenal/core";

const GATED_SET = new Set<EcnStage>(ECN_GATED_STAGES);

/** The one legal forward drop target for a gated stage — its immediately-next
 *  stage in the canonical pipeline (SPRINT-06 E2 AC1). `null` for `pilot`
 *  (whose next stage, `implementation`, isn't itself a further gate) and for
 *  any non-gated stage. */
export function nextEcnStage(stage: EcnStage): EcnStage | null {
  const idx = ECN_STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx + 1 >= ECN_STAGE_ORDER.length) return null;
  return ECN_STAGE_ORDER[idx + 1] ?? null;
}

export type EcnDropAction = "submit" | "withdraw" | "approve" | "reject" | "close" | "resubmit";

/**
 * The Kanban board's drag/drop-to-column legality (SPRINT-06 E2 AC1, DESIGN-06
 * §4.6) — a pure decision table so the "which column may move where" rule is
 * unit-testable without mounting the drag-and-drop board (this app's vitest
 * setup is node-only, no jsdom, per `link-picker.test.ts`'s own precedent).
 * `null` means the drop is illegal and must never reach the API (the API is
 * the real guard regardless, via `ecnMachine`, but a rejected client-side drop
 * never even attempts the call).
 *
 * - Draft → Feasibility: `submit`; Draft → Rejected: `withdraw`.
 * - Any of the 5 gated stages → its own immediate next stage: `approve`.
 * - Any of the 5 gated stages → Rejected: `reject`.
 * - Implementation → Closed: `close`.
 * - Rejected → Draft (the one legal outgoing drag from Rejected): `resubmit`.
 * - Closed has no outgoing drag at all — the board's only fully terminal column.
 */
export function ecnDropAction(from: EcnStage, to: EcnStage): EcnDropAction | null {
  if (from === to) return null;
  if (from === "closed") return null; // fully terminal, no outgoing drag ever
  if (to === "rejected") {
    if (from === "draft") return "withdraw";
    if (GATED_SET.has(from)) return "reject";
    return null; // implementation/rejected/closed can't drop to Rejected
  }
  if (from === "draft" && to === "feasibility") return "submit";
  if (GATED_SET.has(from) && to === nextEcnStage(from)) return "approve";
  if (from === "implementation" && to === "closed") return "close";
  if (from === "rejected" && to === "draft") return "resubmit";
  return null;
}

/** Which capability governs dragging/acting FROM a given column (SPRINT-06 E2
 *  UC's permission rule) — `null` for Closed, which allows no outgoing action
 *  for anyone. */
export function ecnColumnCapability(stage: EcnStage): "ecn:manage" | "ecn:approve" | null {
  if (GATED_SET.has(stage)) return "ecn:approve";
  if (stage === "draft" || stage === "implementation" || stage === "rejected") return "ecn:manage";
  return null;
}

/** Whether the caller may act on (drag or button-advance) a card sitting in
 *  this column, given which of the two capabilities they hold. */
export function canActOnEcnColumn(stage: EcnStage, caps: { canManage: boolean; canApprove: boolean }): boolean {
  const needed = ecnColumnCapability(stage);
  if (needed === null) return false;
  return needed === "ecn:approve" ? caps.canApprove : caps.canManage;
}
