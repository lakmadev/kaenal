import { CapaPhase } from "@kaenal/types";
import { allow, deny, type Decision } from "../result.js";
import { defineMachine, type TransitionMap } from "./machine.js";

/**
 * CAPA phases advance only forward (02 §4). Going back is possible but is a
 * distinct, explicit `revert` action requiring a reason — not something you
 * can do by accident with the same control that advances the phase.
 */
export const CAPA_PHASE_ORDER = CapaPhase.values;

const forwardOnly = (): TransitionMap<CapaPhase> => {
  const map = {} as Record<CapaPhase, readonly CapaPhase[]>;
  CAPA_PHASE_ORDER.forEach((phase, i) => {
    const next = CAPA_PHASE_ORDER[i + 1];
    map[phase] = next === undefined ? [] : [next];
  });
  return map;
};

export const capaMachine = defineMachine<CapaPhase, Record<string, never>>({
  transitions: forwardOnly(),
});

export function capaPhaseIndex(phase: CapaPhase): number {
  return CAPA_PHASE_ORDER.indexOf(phase);
}

export interface CapaRevertContext {
  readonly reason: string;
}

/**
 * Reverting a CAPA to an earlier phase. Separate from the machine because it
 * is an exception path: it always requires a reason and always writes an audit
 * event (02 §4), and it must never be reachable by the normal advance control.
 */
export function canRevertCapa(
  from: CapaPhase,
  to: CapaPhase,
  ctx: CapaRevertContext,
): Decision {
  if (from === "closed") {
    return deny("INVALID_TRANSITION", "A closed CAPA cannot be reverted; reopen a new CAPA instead", {
      allowed: [],
    });
  }

  const fromIndex = capaPhaseIndex(from);
  const toIndex = capaPhaseIndex(to);

  if (toIndex === -1 || fromIndex === -1) {
    return deny("INVALID_TRANSITION", `Unknown CAPA phase`, { allowed: CAPA_PHASE_ORDER });
  }

  if (toIndex >= fromIndex) {
    return deny(
      "INVALID_TRANSITION",
      "Revert must move to an earlier phase — use the advance action to move forward",
      { allowed: CAPA_PHASE_ORDER.slice(0, fromIndex) },
    );
  }

  if (ctx.reason.trim().length === 0) {
    return deny("VALIDATION_FAILED", "A revert requires a reason", { field: "reason" });
  }

  return allow();
}
