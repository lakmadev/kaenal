import type { AuditFindingKind, NcrPriority } from "@kaenal/types";

/**
 * Pure severity→priority default mapping for `audit-findings-tab.tsx`'s raise
 * NCR/CAPA mini-forms, kept apart from the React component so it is
 * unit-testable without rendering anything (same precedent as
 * `lib/collab-crdt.ts`).
 *
 * A major/minor finding maps to the higher NCR/CAPA priority tier; an
 * opportunity finding (never a nonconformance) defaults to the lowest.
 */
export const DEFAULT_PRIORITY: Record<AuditFindingKind, NcrPriority> = {
  major_nc: "critical",
  minor_nc: "major",
  opportunity: "minor",
};
