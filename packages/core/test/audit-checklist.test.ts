import { describe, expect, it } from "vitest";
import {
  auditChecklistProgress,
  seedAuditChecklist,
  IATF_CHECKLIST_CLAUSES,
  bucketAuditFrequency,
} from "../src/audit-checklist.js";

/**
 * Sprint 02 S2-4 checklist pure logic. `progress` is derived, never stored
 * (the dead `audits.progress` column is dropped in migration 0061) — these
 * pin the arithmetic so the service and the web progress bar can't drift.
 */

describe("auditChecklistProgress", () => {
  it("is 0 for an empty checklist (never NaN)", () => {
    expect(auditChecklistProgress([])).toBe(0);
  });

  it("counts every non-pending status as scored, including na/opportunity", () => {
    expect(
      auditChecklistProgress([
        { status: "pending" },
        { status: "conformant" },
        { status: "minor_nc" },
        { status: "major_nc" },
        { status: "opportunity" },
        { status: "na" },
      ]),
    ).toBeCloseTo(5 / 6);
  });

  it("is 1 when every item is scored", () => {
    expect(auditChecklistProgress([{ status: "conformant" }, { status: "na" }])).toBe(1);
  });
});

describe("seedAuditChecklist", () => {
  it("builds one pending item per clause, in order, with the given ids", () => {
    const ids = IATF_CHECKLIST_CLAUSES.map((_, i) => `id-${i}`);
    const items = seedAuditChecklist(ids);
    expect(items).toHaveLength(IATF_CHECKLIST_CLAUSES.length);
    expect(items.every((i) => i.status === "pending" && i.notes === null && i.findingId === null)).toBe(true);
    expect(items.map((i) => i.clause)).toEqual(IATF_CHECKLIST_CLAUSES.map((c) => c.clause));
    expect(items[0]!.id).toBe("id-0");
  });

  it("throws if the id count doesn't match the clause bank (never silently truncates)", () => {
    expect(() => seedAuditChecklist(["only-one"])).toThrow();
    expect(() => seedAuditChecklist([])).toThrow();
  });
});

describe("bucketAuditFrequency", () => {
  const now = new Date("2026-09-15T00:00:00Z");

  it("fills all 6 months, oldest to newest, ending at now's month", () => {
    const points = bucketAuditFrequency([], ["internal"], now);
    expect(points.map((p) => p.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("zero-fills a month/type with no rows instead of omitting it", () => {
    const points = bucketAuditFrequency(
      [{ month: "2026-09", type: "internal", count: 3 }],
      ["internal", "supplier"],
      now,
    );
    const sep = points.find((p) => p.month === "2026-09")!;
    expect(sep.counts).toEqual({ internal: 3, supplier: 0 });
    const apr = points.find((p) => p.month === "2026-04")!;
    expect(apr.counts).toEqual({ internal: 0, supplier: 0 });
  });

  it("ignores a row for a month outside the 6-month window", () => {
    const points = bucketAuditFrequency([{ month: "2025-01", type: "internal", count: 9 }], ["internal"], now);
    expect(points.every((p) => p.counts.internal === 0)).toBe(true);
  });
});
