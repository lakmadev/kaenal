import type { AuditPhase } from "@kaenal/types";

/**
 * Audit checklist (Sprint 02 S2-4). The checklist is a `jsonb` array on the
 * `audits` row (migration 0001, unused until this sprint) — one item per
 * clause, scored `pending → conformant/minor_nc/major_nc/opportunity/na`.
 * These are the pure pieces the service composes: seeding the fixed IATF bank
 * at creation, deriving `progress` from live item statuses (so it can never
 * drift out of sync with a second, stored source of truth — the dead
 * `audits.progress` column is dropped in the migration), and shaping the
 * schedule/frequency views.
 */

export interface AuditChecklistItemShape {
  readonly id: string;
  readonly clause: string;
  readonly section: string;
  readonly text: string;
  readonly status: string;
  readonly notes: string | null;
  readonly findingId: string | null;
}

/** A checklist item scored anything other than `pending` counts toward progress. */
const PROGRESSED_STATUSES = new Set(["conformant", "minor_nc", "major_nc", "opportunity", "na"]);

/**
 * Fraction of the checklist that has been scored (non-`pending`), 0–1. An
 * empty checklist (a legacy pre-migration audit, or one somehow created with
 * none) is 0, never NaN/divide-by-zero.
 */
export function auditChecklistProgress(items: readonly Pick<AuditChecklistItemShape, "status">[]): number {
  if (items.length === 0) return 0;
  const scored = items.filter((i) => PROGRESSED_STATUSES.has(i.status)).length;
  return scored / items.length;
}

/** Checklist statuses that auto-create a linked finding when first scored (S2-4 UC). */
export const NC_CHECKLIST_STATUSES = new Set(["major_nc", "minor_nc", "opportunity"]);

/**
 * The fixed IATF 16949-flavoured clause bank seeded on every newly created
 * audit (S2-4 AC4). FEATURES.md / the implementation spec do not enumerate a
 * specific clause list, so this is the smallest-reasonable-choice default — a
 * dozen representative clauses spanning the standard's structure, logged as an
 * assumption in PROGRESS.md Decisions. `ids` supplies one uuid per clause (the
 * service generates them so this stays a pure function); its length must
 * match the bank.
 */
export const IATF_CHECKLIST_CLAUSES: readonly { clause: string; section: string; text: string }[] = [
  { clause: "4.4", section: "QMS processes", text: "Are process interactions defined, sequenced, and controlled?" },
  { clause: "5.1", section: "Leadership", text: "Does leadership demonstrate accountability for QMS effectiveness?" },
  { clause: "6.1", section: "Risk and opportunity", text: "Are risks and opportunities identified and addressed in planning?" },
  { clause: "7.1.5", section: "Monitoring & measuring resources", text: "Is measurement equipment calibrated, identified, and controlled?" },
  { clause: "7.2", section: "Competence", text: "Is personnel competence for their role evidenced and maintained?" },
  { clause: "7.5", section: "Documented information", text: "Is documented information controlled, current, and available at point of use?" },
  { clause: "8.2", section: "Customer requirements", text: "Are customer requirements reviewed and confirmed before commitment?" },
  { clause: "8.3", section: "Design and development", text: "Is design/development output verified against input requirements?" },
  { clause: "8.4", section: "External providers", text: "Are suppliers selected, evaluated, and controlled per the approved process?" },
  { clause: "8.5.1", section: "Production control", text: "Is production carried out under controlled conditions per the control plan?" },
  { clause: "9.1", section: "Monitoring, measurement, analysis", text: "Are process performance and product conformity monitored and analysed?" },
  { clause: "10.2", section: "Nonconformity & corrective action", text: "Are nonconformities addressed with root cause analysis and corrective action?" },
];

/** Build the seeded checklist for a newly created audit. `ids` must have one
 *  entry per clause in {@link IATF_CHECKLIST_CLAUSES}, in order. */
export function seedAuditChecklist(ids: readonly string[]): AuditChecklistItemShape[] {
  if (ids.length !== IATF_CHECKLIST_CLAUSES.length) {
    throw new Error(`seedAuditChecklist needs ${IATF_CHECKLIST_CLAUSES.length} ids, got ${ids.length}`);
  }
  return IATF_CHECKLIST_CLAUSES.map((c, i) => ({
    id: ids[i]!,
    clause: c.clause,
    section: c.section,
    text: c.text,
    status: "pending",
    notes: null,
    findingId: null,
  }));
}

/** Display label for an audit phase (schedule view, phase tracker). */
export const AUDIT_PHASE_LABEL: Readonly<Record<AuditPhase, string>> = {
  planned: "Planned",
  preparation: "Preparation",
  fieldwork: "Fieldwork",
  reporting: "Reporting",
  closed: "Closed",
};

/** One month's audit counts, keyed by `AuditType`. */
export interface AuditFrequencyPoint {
  readonly month: string; // "YYYY-MM"
  readonly counts: Readonly<Record<string, number>>;
}

/** "YYYY-MM" for the month `offset` months before `now` (0 = this month). */
function monthKey(now: Date, offset: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fill the last 6 months (oldest → newest, ending at `now`'s month) with
 * per-type counts from a sparse `{month, type, count}` aggregation — a month
 * or type with zero audits still appears with `0`, so the chart never has to
 * guess at a gap.
 */
export function bucketAuditFrequency(
  rows: readonly { month: string; type: string; count: number }[],
  types: readonly string[],
  now: Date,
): AuditFrequencyPoint[] {
  const months = Array.from({ length: 6 }, (_, i) => monthKey(now, 5 - i));
  const byMonth = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? new Map<string, number>();
    m.set(r.type, r.count);
    byMonth.set(r.month, m);
  }
  return months.map((month) => {
    const found = byMonth.get(month);
    const counts: Record<string, number> = {};
    for (const t of types) counts[t] = found?.get(t) ?? 0;
    return { month, counts };
  });
}
