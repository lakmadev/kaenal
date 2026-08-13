/**
 * SCAR (Supplier Corrective Action Request) domain logic (FEATURES §11.3, P10).
 *
 * A SCAR is an 8D run *with* a supplier: progress is tracked D-step by D-step
 * (D1–D8), forward only, exactly like the shop-floor 8D. The step machine, the
 * chargeback transition legality, and the overdue / days-open derivations live
 * here — pure and testable — rather than in a query or the UI (CLAUDE.md rule 5).
 *
 * `status` is the coarse lifecycle (draft → open/responded → closed, or
 * rejected/cancelled). The `current_d` step is the fine-grained 8D progress. The
 * visual spec's `awaiting_d4` / `d5_review` labels are a *display composition* of
 * (status, current_d) — see {@link scarStageLabel} — not stored status values.
 * `overdue` is derived (see {@link scarIsOverdue}), never stored.
 */

/** `now` as a `YYYY-MM-DD` string (UTC), for date-only comparisons. */
function dateOnly(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export type ScarSeverity = "minor" | "major" | "critical";
export type ScarStatus = "draft" | "open" | "responded" | "closed" | "rejected" | "cancelled";
export type ChargebackStatus = "pending" | "debit_issued" | "closed";

/** The eight 8D disciplines, in order. `current_d` is the id (1–8). */
export const SCAR_D_STEPS: readonly { readonly id: number; readonly name: string }[] = [
  { id: 1, name: "Team" },
  { id: 2, name: "Problem Description" },
  { id: 3, name: "Containment" },
  { id: 4, name: "Root Cause" },
  { id: 5, name: "Corrective Actions" },
  { id: 6, name: "Implement & Validate" },
  { id: 7, name: "Prevent Recurrence" },
  { id: 8, name: "Closure & Recognition" },
] as const;

export const FIRST_D = 1;
export const LAST_D = 8;

/** True once the SCAR has reached D8 (the last discipline). */
export function isFinalD(currentD: number): boolean {
  return currentD >= LAST_D;
}

/**
 * The next D-step for a forward-only advance. Throws past D8 — a SCAR at closure
 * has nowhere further to go; the caller closes it via the lifecycle status
 * instead. Mirrors the CAPA advance machine (P05): forward only, no skipping.
 */
export function nextD(currentD: number): number {
  if (!Number.isInteger(currentD) || currentD < FIRST_D || currentD > LAST_D) {
    throw new Error(`Invalid D-step: ${currentD}`);
  }
  if (currentD >= LAST_D) {
    throw new Error("Already at D8 — the SCAR cannot advance further");
  }
  return currentD + 1;
}

/**
 * Lifecycle statuses that count as still-active (a SCAR that can go overdue and
 * still needs work). A closed / rejected / cancelled SCAR is never "overdue".
 */
const ACTIVE_STATUSES: ReadonlySet<ScarStatus> = new Set<ScarStatus>(["draft", "open", "responded"]);

export function isScarActive(status: ScarStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

/**
 * Overdue is derived, not stored: an active SCAR whose supplier-response-due
 * date (preferred) or overall due date has passed. Closed / rejected / cancelled
 * SCARs are never overdue regardless of dates. Dates are `YYYY-MM-DD`; the
 * comparison is date-only (a SCAR due today is not yet overdue).
 */
export function scarIsOverdue(
  input: {
    readonly status: ScarStatus;
    readonly dueDate?: string | null;
    readonly supplierResponseDue?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (!isScarActive(input.status)) return false;
  const today = dateOnly(now);
  const due = input.supplierResponseDue ?? input.dueDate ?? null;
  if (due === null || due === "") return false;
  return due < today;
}

/**
 * A display label for the SCAR's stage, mirroring the visual spec's
 * `awaiting_d4` / `d5_review` composition. Terminal statuses render themselves;
 * an active SCAR renders as its current discipline (e.g. "D4 · Root Cause").
 */
export function scarStageLabel(status: ScarStatus, currentD: number): string {
  if (!isScarActive(status)) return status;
  const step = SCAR_D_STEPS.find((s) => s.id === currentD);
  return step ? `D${step.id} · ${step.name}` : `D${currentD}`;
}

/**
 * Days a SCAR has been open: whole days from its raised date to `now` (never
 * negative). Returns null when there is no raised date yet.
 */
export function scarDaysOpen(raisedDate: string | null | undefined, now: Date = new Date()): number | null {
  if (raisedDate === null || raisedDate === undefined || raisedDate === "") return null;
  const start = new Date(raisedDate).getTime();
  if (Number.isNaN(start)) return null;
  const ms = now.getTime() - start;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Legal chargeback transitions — forward only: pending → debit_issued → closed.
 * A chargeback is *raised* into `pending` (from none); once a debit is issued it
 * cannot un-issue, and once closed it is final. Cost recovery is a one-way ratchet.
 */
const CHARGEBACK_NEXT: Readonly<Record<ChargebackStatus, readonly ChargebackStatus[]>> = {
  pending: ["debit_issued"],
  debit_issued: ["closed"],
  closed: [],
};

/**
 * Whether a chargeback may move from `from` to `to`. `from` is null when no
 * chargeback exists yet, in which case only `pending` may be raised.
 */
export function canTransitionChargeback(from: ChargebackStatus | null, to: ChargebackStatus): boolean {
  if (from === null) return to === "pending";
  if (from === to) return false;
  return CHARGEBACK_NEXT[from].includes(to);
}
