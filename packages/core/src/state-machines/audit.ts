import { AuditPhase } from "@kaenal/types";
import { defineMachine, type TransitionMap } from "./machine.js";

/**
 * Audit phases (02 §2) advance forward through a fixed sequence:
 *   planned → preparation → fieldwork → reporting → closed
 * There is no cancel state in the schema and no specified backward path, so the
 * machine is strictly linear — one step at a time, no skipping.
 */
export const AUDIT_PHASE_ORDER = AuditPhase.values;

const forwardOnly = (): TransitionMap<AuditPhase> => {
  const map = {} as Record<AuditPhase, readonly AuditPhase[]>;
  AUDIT_PHASE_ORDER.forEach((phase, i) => {
    const next = AUDIT_PHASE_ORDER[i + 1];
    map[phase] = next === undefined ? [] : [next];
  });
  return map;
};

export const auditMachine = defineMachine<AuditPhase, Record<string, never>>({
  transitions: forwardOnly(),
});
