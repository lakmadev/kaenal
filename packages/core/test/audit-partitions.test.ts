import { describe, expect, it } from "vitest";
import {
  auditPartitionName,
  auditPartitionRange,
  monthStart,
  nextMonth,
  upcomingPartitionMonths,
  isTampered,
  highWater,
} from "../src/audit-partitions.js";

/**
 * Audit-events partition arithmetic (07 §1). Names and bounds must line up with
 * the Postgres monthly RANGE partitions exactly — an off-by-one on the month
 * boundary would route a row to the wrong partition or to none.
 */

describe("month math (UTC)", () => {
  it("monthStart / nextMonth pin the UTC month boundaries", () => {
    const d = new Date("2026-07-23T14:05:00Z");
    expect(monthStart(d).toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(nextMonth(d).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("rolls the year over December → January", () => {
    expect(nextMonth(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("partition naming + bounds", () => {
  it("names a partition after its zero-padded month", () => {
    expect(auditPartitionName(new Date("2026-07-23T00:00:00Z"))).toBe("audit_events_2026_07");
    expect(auditPartitionName(new Date("2026-01-01T00:00:00Z"))).toBe("audit_events_2026_01");
  });

  it("ranges half-open [monthStart, nextMonth)", () => {
    const { from, to } = auditPartitionRange(new Date("2026-07-23T00:00:00Z"));
    expect(from).toBe("2026-07-01T00:00:00.000Z");
    expect(to).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("upcomingPartitionMonths", () => {
  it("is the current month and the next one", () => {
    const months = upcomingPartitionMonths(new Date("2026-07-23T00:00:00Z"));
    expect(months.map((m) => m.toISOString())).toEqual([
      "2026-07-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
    ]);
  });
});

describe("tamper detection", () => {
  it("flags a shrink, not growth or a steady count", () => {
    expect(isTampered(100, 99)).toBe(true); // a delete happened
    expect(isTampered(100, 100)).toBe(false);
    expect(isTampered(100, 150)).toBe(false); // append-only growth
    expect(isTampered(0, 0)).toBe(false);
  });

  it("high-water never lowers the recorded count", () => {
    expect(highWater(100, 150)).toBe(150);
    expect(highWater(100, 80)).toBe(100); // keep the mark so the shrink stays visible
  });
});
