/**
 * PPAP (Production Part Approval Process) domain logic (FEATURES §11.2, P09).
 *
 * The 18 PPAP elements and the approvability rule live here — pure and testable —
 * rather than in a query or the UI (0001's "raw structure in jsonb, rules in
 * packages/core" choice, and CLAUDE.md rule 5). A submission stores its elements
 * inline as jsonb; this module defines the canonical element list a new
 * submission is seeded with and decides when the package may be approved.
 *
 * The rule mirrors the visual spec's "auto-checked element completeness 17/18":
 * a submission is approvable only when every element that is not marked N/A has
 * reached `approved`. A `pending` or `changes_requested` element blocks approval.
 */

export type PpapElementStatus = "pending" | "approved" | "changes_requested" | "n_a";

/** The 18 canonical AIAG PPAP elements, in order. Element 18 is the PSW. */
export const PPAP_ELEMENTS: readonly { readonly id: number; readonly name: string }[] = [
  { id: 1, name: "Design Records" },
  { id: 2, name: "Engineering Change Documents" },
  { id: 3, name: "Customer Engineering Approval" },
  { id: 4, name: "Design FMEA" },
  { id: 5, name: "Process Flow Diagrams" },
  { id: 6, name: "Process FMEA" },
  { id: 7, name: "Control Plan" },
  { id: 8, name: "Measurement Systems Analysis" },
  { id: 9, name: "Dimensional Results" },
  { id: 10, name: "Material / Performance Tests" },
  { id: 11, name: "Initial Process Studies" },
  { id: 12, name: "Qualified Laboratory Documentation" },
  { id: 13, name: "Appearance Approval Report" },
  { id: 14, name: "Sample Production Parts" },
  { id: 15, name: "Master Sample" },
  { id: 16, name: "Checking Aids" },
  { id: 17, name: "Customer-Specific Requirements" },
  { id: 18, name: "Part Submission Warrant (PSW)" },
] as const;

/** The PSW is always element 18 (the warrant that fronts the package). */
export const PSW_ELEMENT_ID = 18;

export interface PpapElementState {
  readonly id: number;
  readonly status: PpapElementStatus;
}

/** A fresh package: all 18 elements `pending`, with no reviewer or comment yet. */
export function seedPpapElements(): {
  id: number;
  name: string;
  status: PpapElementStatus;
  reviewer: string | null;
  comment: string | null;
}[] {
  return PPAP_ELEMENTS.map((e) => ({ id: e.id, name: e.name, status: "pending", reviewer: null, comment: null }));
}

export interface PpapCompleteness {
  /** Elements that count toward approval (everything not marked N/A). */
  readonly required: number;
  /** Of the required elements, how many are `approved`. */
  readonly approved: number;
  /** Elements still `pending` or `changes_requested`. */
  readonly outstanding: number;
  /** True when every non-N/A element is `approved`. */
  readonly approvable: boolean;
}

/**
 * Completeness of a submission's elements. N/A elements are excluded from the
 * denominator (they are a deliberate "not applicable", not a gap), so a package
 * with legitimately-waived elements can still reach 100%.
 */
export function ppapCompleteness(elements: readonly PpapElementState[]): PpapCompleteness {
  const required = elements.filter((e) => e.status !== "n_a");
  const approved = required.filter((e) => e.status === "approved").length;
  const outstanding = required.length - approved;
  return {
    required: required.length,
    approved,
    outstanding,
    // An empty package (no required elements) is not approvable — there is
    // nothing to warrant.
    approvable: required.length > 0 && outstanding === 0,
  };
}

/** Convenience predicate — see {@link ppapCompleteness}. */
export function isPpapApprovable(elements: readonly PpapElementState[]): boolean {
  return ppapCompleteness(elements).approvable;
}

/**
 * Days a submission has been open: whole days from its submitted date to `now`
 * (never negative). Returns null when there is no submitted date yet.
 */
export function ppapDaysOpen(submittedDate: string | null | undefined, now: Date = new Date()): number | null {
  if (submittedDate === null || submittedDate === undefined || submittedDate === "") return null;
  const start = new Date(submittedDate).getTime();
  if (Number.isNaN(start)) return null;
  const ms = now.getTime() - start;
  return Math.max(0, Math.floor(ms / 86_400_000));
}
