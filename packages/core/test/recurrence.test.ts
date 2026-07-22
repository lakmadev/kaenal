import { describe, expect, it } from "vitest";
import {
  expandOccurrences,
  lastDayOfMonth,
  SCHEDULE_HORIZON_DAYS,
  toIsoDate,
  type RecurrenceRule,
} from "../src/recurrence.js";

/**
 * Recurrence expansion (08 §1.2). The spec singles out the calendar traps —
 * Feb 29 and month-end "31st" clamping to the last day — so those are pinned
 * explicitly, alongside the freq/interval/byweekday/until behaviour the
 * `schedule` job depends on. Pure date math, no clock.
 */

const d = (iso: string): Date => new Date(iso);
const window = (anchor: string, from: string, to: string) => ({
  anchor: d(anchor),
  from: d(from),
  to: d(to),
});

describe("daily", () => {
  it("emits every day at interval 1 within the window", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1 };
    const out = expandOccurrences(rule, window("2026-03-01T09:00:00Z", "2026-03-01T00:00:00Z", "2026-03-05T00:00:00Z"));
    expect(out).toEqual(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"]);
  });

  it("steps by the interval and stays phased to the anchor", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 3 };
    // Window starts mid-series: only anchor-phased days (…04, 07, 10) appear.
    const out = expandOccurrences(rule, window("2026-03-01T00:00:00Z", "2026-03-03T00:00:00Z", "2026-03-11T00:00:00Z"));
    expect(out).toEqual(["2026-03-04", "2026-03-07", "2026-03-10"]);
  });

  it("respects `until` (inclusive)", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1, until: "2026-03-03T00:00:00Z" };
    const out = expandOccurrences(rule, window("2026-03-01T00:00:00Z", "2026-03-01T00:00:00Z", "2026-03-31T00:00:00Z"));
    expect(out).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("never emits before the anchor", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1 };
    const out = expandOccurrences(rule, window("2026-03-10T00:00:00Z", "2026-03-01T00:00:00Z", "2026-03-12T00:00:00Z"));
    expect(out).toEqual(["2026-03-10", "2026-03-11", "2026-03-12"]);
  });
});

describe("weekly", () => {
  it("defaults to the anchor's weekday", () => {
    // 2026-03-02 is a Monday.
    const rule: RecurrenceRule = { freq: "weekly", interval: 1 };
    const out = expandOccurrences(rule, window("2026-03-02T00:00:00Z", "2026-03-02T00:00:00Z", "2026-03-23T00:00:00Z"));
    expect(out).toEqual(["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23"]);
  });

  it("emits each named weekday, skipping inactive weeks at interval 2", () => {
    // byweekday Mon(1) + Wed(3), every 2 weeks, anchored on a Monday.
    const rule: RecurrenceRule = { freq: "weekly", interval: 2, byweekday: [1, 3] };
    const out = expandOccurrences(rule, window("2026-03-02T00:00:00Z", "2026-03-01T00:00:00Z", "2026-03-31T00:00:00Z"));
    // Active weeks (interval 2): anchor week (Mar 2/4), +2wk (Mar 16/18),
    // +4wk (Mar 30; its Wed Apr 1 is past the window end).
    expect(out).toEqual(["2026-03-02", "2026-03-04", "2026-03-16", "2026-03-18", "2026-03-30"]);
  });
});

describe("monthly — the calendar traps", () => {
  it("clamps a 31st anchor to each month's last day", () => {
    const rule: RecurrenceRule = { freq: "monthly", interval: 1 };
    const out = expandOccurrences(rule, window("2026-01-31T00:00:00Z", "2026-01-01T00:00:00Z", "2026-05-01T00:00:00Z"));
    // Jan 31 → Feb 28 (2026 not a leap year) → Mar 31 → Apr 30.
    expect(out).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("lands a Feb-29 anchor on Feb 28 in non-leap years, never Mar 1", () => {
    // 2024 is a leap year; step yearly-ish via 12-month interval.
    const rule: RecurrenceRule = { freq: "monthly", interval: 12 };
    const out = expandOccurrences(rule, window("2024-02-29T00:00:00Z", "2024-01-01T00:00:00Z", "2027-03-01T00:00:00Z"));
    expect(out).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28"]);
    expect(out.some((s) => s.endsWith("-03-01"))).toBe(false);
  });

  it("does not drift: clamped months re-expand from the true anchor day", () => {
    // Aug 31 must not become Sep 30 then Oct 30 — Oct has a 31st.
    const rule: RecurrenceRule = { freq: "monthly", interval: 1 };
    const out = expandOccurrences(rule, window("2026-08-31T00:00:00Z", "2026-08-01T00:00:00Z", "2026-11-01T00:00:00Z"));
    expect(out).toEqual(["2026-08-31", "2026-09-30", "2026-10-31"]);
  });
});

describe("helpers", () => {
  it("lastDayOfMonth handles Feb in leap and non-leap years", () => {
    expect(lastDayOfMonth(2024, 1)).toBe(29);
    expect(lastDayOfMonth(2026, 1)).toBe(28);
    expect(lastDayOfMonth(2026, 3)).toBe(30); // April
    expect(lastDayOfMonth(2026, 0)).toBe(31); // January
  });

  it("toIsoDate takes the UTC calendar day", () => {
    expect(toIsoDate(new Date("2026-03-02T23:30:00Z"))).toBe("2026-03-02");
  });

  it("horizon is 14 days", () => {
    expect(SCHEDULE_HORIZON_DAYS).toBe(14);
  });

  it("an empty window (anchor after end) yields nothing", () => {
    const rule: RecurrenceRule = { freq: "daily", interval: 1 };
    expect(expandOccurrences(rule, window("2026-04-01T00:00:00Z", "2026-03-01T00:00:00Z", "2026-03-15T00:00:00Z"))).toEqual([]);
  });
});
