import { describe, expect, it } from "vitest";
import { checklistCounts } from "@/features/audits/audit-checklist-logic";
import { auditStatusBadgeValue } from "@/features/audits/audit-types";

/**
 * Checklist scoring (S2-4). `checklistCounts` drives the tab's header strip
 * (conformant / NC / pending) directly from `audit.checklist` — pin its
 * bucketing, including that `opportunity`/`na` deliberately fall into none of
 * the three buckets (they are neither a pass nor an open pending item).
 */
describe("checklistCounts", () => {
  it("is all-zero for an empty checklist", () => {
    expect(checklistCounts([])).toEqual({ conformant: 0, ncs: 0, pending: 0 });
  });

  it("counts conformant items", () => {
    expect(
      checklistCounts([{ status: "conformant" }, { status: "conformant" }, { status: "pending" }]),
    ).toEqual({ conformant: 2, ncs: 0, pending: 1 });
  });

  it("buckets both minor_nc and major_nc under ncs", () => {
    expect(checklistCounts([{ status: "minor_nc" }, { status: "major_nc" }])).toEqual({
      conformant: 0,
      ncs: 2,
      pending: 0,
    });
  });

  it("excludes opportunity and na from every bucket (not conformant, not NC, not pending)", () => {
    const counts = checklistCounts([{ status: "opportunity" }, { status: "na" }]);
    expect(counts).toEqual({ conformant: 0, ncs: 0, pending: 0 });
  });

  it("tallies a realistic mixed checklist correctly", () => {
    const items = [
      { status: "conformant" },
      { status: "conformant" },
      { status: "minor_nc" },
      { status: "major_nc" },
      { status: "pending" },
      { status: "opportunity" },
      { status: "na" },
    ] as const;
    expect(checklistCounts(items)).toEqual({ conformant: 2, ncs: 2, pending: 1 });
    // Sum of the three buckets is less than the item count whenever
    // opportunity/na items are present — that gap is intentional, not a bug.
    const total = Object.values(checklistCounts(items)).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
    expect(items.length).toBe(7);
  });
});

/** Phase→badge mapping (`audits.jsx:134` parity) driving the shared `StatusBadge`. */
describe("auditStatusBadgeValue", () => {
  it("maps closed to closed", () => {
    expect(auditStatusBadgeValue("closed")).toBe("closed");
  });

  it("maps planned to scheduled", () => {
    expect(auditStatusBadgeValue("planned")).toBe("scheduled");
  });

  it("maps every mid-lifecycle phase to in_progress", () => {
    for (const phase of ["preparation", "fieldwork", "reporting"] as const) {
      expect(auditStatusBadgeValue(phase)).toBe("in_progress");
    }
  });
});
