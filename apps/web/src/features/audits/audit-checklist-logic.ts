import type { AuditChecklistStatus } from "@kaenal/types";

/**
 * Pure checklist-scoring logic for `audit-checklist-tab.tsx`, kept apart from
 * the React component (same precedent as `lib/collab-crdt.ts`) so the counting
 * rule is unit-testable without rendering anything.
 */

/**
 * Header counts strip: conformant / NC (minor+major) / pending, from the
 * audit's real `checklist` array. `opportunity` and `na` items count toward
 * none of the three buckets — intentional (they are neither a conformance
 * pass nor an open item awaiting scoring), pinned by test so a future bucket
 * rename can't silently reclassify them.
 */
export function checklistCounts(items: readonly { status: AuditChecklistStatus }[]): {
  conformant: number;
  ncs: number;
  pending: number;
} {
  return {
    conformant: items.filter((i) => i.status === "conformant").length,
    ncs: items.filter((i) => i.status === "minor_nc" || i.status === "major_nc").length,
    pending: items.filter((i) => i.status === "pending").length,
  };
}
