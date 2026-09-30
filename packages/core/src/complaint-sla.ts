import type { ComplaintSeverity, SlaState } from "@kaenal/types";
import { AT_RISK_THRESHOLD } from "./sla.js";

/**
 * Complaint SLA (SPRINT-06 §3.1, corrected §0 B7).
 *
 * Two distinct target shapes, both fixed config this sprint (P18 names no
 * tenant-configurability, and no settings screen exists yet to hold it):
 *
 *   | Severity | Acknowledge target (hours) | Close target (days) |
 *   |----------|-----------------------------|----------------------|
 *   | critical | 1                           | 14                   |
 *   | high     | 4                           | 21                   |
 *   | medium   | 24                          | 45                   |
 *   | low      | 48                          | 90                   |
 *
 * The ACKNOWLEDGE target drives `complaintSlaState` below. It is a PLAIN
 * elapsed-hours comparison, deliberately NOT routed through `sla.ts`'s
 * `computeDueAt`/`addBusinessHours` — the matrix names the acknowledge target
 * in plain hours with no business-hours qualifier (unlike NCR's
 * `respondHours`, which 03 §10 explicitly scopes to business hours), and
 * `computeDueAt` is inherently business-hours-aware with no plain-elapsed
 * mode, so it is correctly never called here at all: a critical field-failure
 * complaint doesn't stop its 1-hour clock overnight (§0 B7d).
 *
 * The CLOSE target (`sla_close_target_days`) is a plain calendar-day count
 * (`received_at + N days`) — display-only this sprint (no auto-escalate on
 * close-breach is specified), so it has no computed-state function here.
 *
 * `AT_RISK_THRESHOLD` is imported, not redefined — the same 0.8 constant
 * `sla.ts`'s own `computeSlaState` uses, confirmed at `sla.ts:163` (§0 B7d,
 * corrected from an inconsistent, never-actually-used second 75% constant).
 */

export interface ComplaintSlaTargets {
  readonly ackHours: number;
  readonly closeDays: number;
}

export const COMPLAINT_SLA_MATRIX: Readonly<Record<ComplaintSeverity, ComplaintSlaTargets>> = {
  critical: { ackHours: 1, closeDays: 14 },
  high: { ackHours: 4, closeDays: 21 },
  medium: { ackHours: 24, closeDays: 45 },
  low: { ackHours: 48, closeDays: 90 },
};

/** Looked up once at creation (and re-derived on a `severity` `PATCH`, §0
 *  B7c) and denormalized onto the row — a later change to this matrix must
 *  never retroactively alter an existing complaint's own due dates (mirrors
 *  Sprint 05 T1 AC1's `training_records.valid_months` precedent exactly). */
export function complaintSlaTargetsFor(severity: ComplaintSeverity): ComplaintSlaTargets {
  return COMPLAINT_SLA_MATRIX[severity];
}

export interface ComplaintSlaInput {
  /** Denormalized on the row at creation (or re-derived on a severity edit) —
   *  never looked up fresh from the matrix here (§0 B7c). */
  readonly slaTargetHours: number;
  readonly receivedAt: string;
  readonly acknowledgedAt: string | null;
  readonly closedAt: string | null;
  /** ISO strings throughout, never JS `Date` objects (mirrors Sprint 05 B4's
   *  deliberate deviation for the same `pg` timezone-shift reason). */
  readonly now: string;
}

function hoursBetween(fromIso: string, toIso: string): number {
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  return (toMs - fromMs) / 3_600_000;
}

/**
 * Classifies a complaint's acknowledge-clock SLA state. Computed on every
 * read, never stored (this codebase's established norm for a cheap
 * derivation — `rbac.ts`'s carried-over C1a comment).
 *
 * Rules, in order (§0 B7b, explicit — not left implicit):
 *   1. If `closedAt` is set, the state is FROZEN at whichever it resolved to
 *      at closing time — never recomputed against a later `now`. (Achieved
 *      by using `closedAt` as the reference instant below whenever it is
 *      set, instead of the real, possibly-much-later `now`.)
 *   2. Otherwise, if `acknowledgedAt` is set, the state is fixed FOREVER at
 *      whichever it resolved to at that moment: `on_track` if acknowledged
 *      within `slaTargetHours` of receipt, else `breached` — a late first
 *      response stays permanently `breached` for this leg regardless of what
 *      happens after. (This branch never depends on `now`/`closedAt` at all,
 *      so it is already frozen by construction.)
 *   3. If not yet acknowledged: `breached` once elapsed hours (against the
 *      frozen-or-live reference instant) exceed `slaTargetHours`, `at_risk`
 *      once elapsed hours are ≥ `AT_RISK_THRESHOLD` (0.8) of `slaTargetHours`,
 *      else `on_track`.
 */
export function complaintSlaState(input: ComplaintSlaInput): SlaState {
  const referenceNow = input.closedAt ?? input.now;

  if (input.acknowledgedAt !== null) {
    const elapsedAtAck = hoursBetween(input.receivedAt, input.acknowledgedAt);
    return elapsedAtAck <= input.slaTargetHours ? "on_track" : "breached";
  }

  const elapsed = hoursBetween(input.receivedAt, referenceNow);
  if (elapsed > input.slaTargetHours) return "breached";
  if (elapsed >= input.slaTargetHours * AT_RISK_THRESHOLD) return "at_risk";
  return "on_track";
}
