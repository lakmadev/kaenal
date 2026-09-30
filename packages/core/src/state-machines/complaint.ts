import type { ComplaintSeverity, ComplaintStatus, NcrPriority, WizardPriority } from "@kaenal/types";
import { defineMachine, type TransitionMap } from "./machine.js";

/**
 * Complaint lifecycle (SPRINT-06 §2 C3/C4, `complaints.status`'s CHECK,
 * migration 0071) — `triage → investigation → 8d → capa → closed`.
 *
 * Unlike ECN's forward-only pipeline, a complaint's `status` is not driven by
 * a single chosen next state: `POST /v1/complaints/:id/convert` (C4) advances
 * it to the RANK-MAX of its current status and whichever target it converted
 * to (never backward — converting to a chronologically-earlier target, e.g.
 * "convert to NCR" on a complaint already at `8d`, is allowed and links the
 * record but does not move `status` backward, §0 B6c). `POST .../close` (C3)
 * is the one plain state transition — any non-`closed` status to `closed`,
 * allowed with or without ever having converted (the jsx's own `COM-2026-
 * 0080` example closes after being linked to an NCR, proving closing isn't
 * gated on conversion, §2 C3 UC).
 *
 * This module is the pure "is this legal" logic; `ComplaintsService` (out of
 * this slice) does the actual `SELECT ... FOR UPDATE` + `WHERE lock_version =
 * ... AND status <> 'closed'` writes (§0 B6a/b).
 */

/**
 * Rank order for the convert-driven "never regress" rule (§2 C4 AC2) and the
 * register's "Linked" column (single most-advanced linked record, §0 B8d) —
 * both defined against this same ordering: `capa` > `eight_d` > `ncr`.
 */
export const COMPLAINT_STATUS_RANK: Readonly<Record<ComplaintStatus, number>> = {
  triage: 0,
  investigation: 1,
  "8d": 2,
  capa: 3,
  closed: 4,
};

export function complaintStatusRank(status: ComplaintStatus): number {
  return COMPLAINT_STATUS_RANK[status];
}

/**
 * The rank-max advance C4 AC2 requires: converting to `target` never moves a
 * complaint's status backward, and never past `closed` (closed is checked by
 * the service's own `status <> 'closed'` guard before this is even called —
 * this function does not special-case it beyond never letting rank decrease).
 */
export function advanceComplaintStatus(
  current: ComplaintStatus,
  target: Exclude<ComplaintStatus, "closed">,
): ComplaintStatus {
  return complaintStatusRank(target) > complaintStatusRank(current) ? target : current;
}

/** Every non-`closed` status may close; `closed` itself is terminal. */
const COMPLAINT_TRANSITIONS: TransitionMap<ComplaintStatus> = {
  triage: ["closed"],
  investigation: ["closed"],
  "8d": ["closed"],
  capa: ["closed"],
  closed: [],
};

/**
 * `defineMachine`'s own same-state check already denies `closed → closed`
 * with `INVALID_TRANSITION` (machine.ts) — exactly the "422 if already
 * closed" outcome §2 C3 AC2 asks for, with no extra guard needed here.
 */
export const complaintMachine = defineMachine<ComplaintStatus, Record<string, never>>({
  transitions: COMPLAINT_TRANSITIONS,
});

/**
 * Severity → priority mapping (§0 B6g), stated explicitly in the sprint's
 * amendment table — never invented at build time and never accepted as a
 * client-supplied field on the convert body.
 */
const SEVERITY_TO_NCR_PRIORITY: Readonly<Record<ComplaintSeverity, NcrPriority>> = {
  critical: "critical",
  high: "major",
  medium: "minor",
  low: "minor",
};

const SEVERITY_TO_WIZARD_PRIORITY: Readonly<Record<ComplaintSeverity, WizardPriority>> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

/** NCR/CAPA share `NcrPriority`'s 3-value set (minor/major/critical) — used
 *  by the `target: "ncr"` and `target: "capa"` convert variants (§0 B6g). */
export function complaintSeverityToNcrPriority(severity: ComplaintSeverity): NcrPriority {
  return SEVERITY_TO_NCR_PRIORITY[severity];
}

/** 8D's `priority` is typed `WizardPriority` (4 values, matching severity
 *  1:1) — used by the `target: "eight_d"` convert variant (§0 B6g). */
export function complaintSeverityToWizardPriority(severity: ComplaintSeverity): WizardPriority {
  return SEVERITY_TO_WIZARD_PRIORITY[severity];
}
