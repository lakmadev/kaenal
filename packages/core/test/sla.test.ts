import { describe, expect, it } from "vitest";
import {
  addBusinessHours,
  businessHoursBetween,
  computeDueAt,
  computeSlaState,
  type BusinessHours,
  type SlaConfigByPriority,
} from "../src/index.js";

/**
 * SLA math (08 §1.2): business hours, weekends, tenant timezones, and DST
 * transitions in both directions.
 *
 * Assertions are written in the tenant's WALL CLOCK, because that is the
 * contract with the customer ("resolve by Tuesday 10:00"). A naive UTC
 * implementation passes the weekday cases and then silently returns a due date
 * an hour off for half the year — which is exactly what these tests exist to
 * catch.
 */

const MON_FRI: BusinessHours = { days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" };

/** Formats an instant as wall-clock in `tz` — how a user would read it. */
function localString(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(", ", " ");
}

/** Builds an instant from a wall-clock reading in `tz`. */
function at(local: string, tz: string): Date {
  const [datePart, timePart] = local.split(" ");
  const [y, m, d] = (datePart ?? "").split("-").map(Number);
  const [hh, mm] = (timePart ?? "").split(":").map(Number);
  // Probe UTC, then correct by the offset the zone reports at that instant.
  const guess = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  const reported = new Date(guess);
  const asLocal = localString(reported, tz);
  const [ld, lt] = asLocal.split(" ");
  const [ly, lm, ldd] = (ld ?? "").split("-").map(Number);
  const [lhh, lmm] = (lt ?? "").split(":").map(Number);
  const drift =
    Date.UTC(ly ?? 0, (lm ?? 1) - 1, ldd ?? 1, lhh ?? 0, lmm ?? 0) - guess;
  return new Date(guess - drift);
}

describe("addBusinessHours — within a single window", () => {
  it("adds hours inside the working day", () => {
    const from = at("2026-06-15 09:00", "UTC"); // Monday
    expect(localString(addBusinessHours(from, 4, MON_FRI, "UTC"), "UTC")).toBe("2026-06-15 13:00");
  });

  it("lands exactly on the closing bell", () => {
    const from = at("2026-06-15 08:00", "UTC");
    expect(localString(addBusinessHours(from, 9, MON_FRI, "UTC"), "UTC")).toBe("2026-06-15 17:00");
  });

  it("returns the start instant unchanged for zero hours", () => {
    const from = at("2026-06-15 09:00", "UTC");
    expect(addBusinessHours(from, 0, MON_FRI, "UTC").getTime()).toBe(from.getTime());
  });
});

describe("addBusinessHours — outside working hours", () => {
  it("starts the clock at the next opening when raised before work", () => {
    const from = at("2026-06-15 05:00", "UTC"); // Monday, pre-shift
    expect(localString(addBusinessHours(from, 2, MON_FRI, "UTC"), "UTC")).toBe("2026-06-15 10:00");
  });

  it("rolls to the next morning when raised after close", () => {
    const from = at("2026-06-15 22:00", "UTC"); // Monday night
    expect(localString(addBusinessHours(from, 2, MON_FRI, "UTC"), "UTC")).toBe("2026-06-16 10:00");
  });

  it("does not burn the weekend for a Friday-night NCR", () => {
    // Raised 22:00 Friday: the full allowance should start Monday 08:00.
    const from = at("2026-06-19 22:00", "UTC"); // Friday
    expect(localString(addBusinessHours(from, 3, MON_FRI, "UTC"), "UTC")).toBe("2026-06-22 11:00");
  });

  it("spills across multiple days", () => {
    // 20h at 9h/day: Mon 08:00 +9 → Tue +9 → Wed 2h remaining.
    const from = at("2026-06-15 08:00", "UTC");
    expect(localString(addBusinessHours(from, 20, MON_FRI, "UTC"), "UTC")).toBe("2026-06-17 10:00");
  });

  it("skips configured holidays", () => {
    const withHoliday: BusinessHours = { ...MON_FRI, holidays: ["2026-06-16"] };
    const from = at("2026-06-15 16:00", "UTC"); // Monday, 1h left
    // 3h: 1h Monday, then Tuesday is a holiday, so 2h on Wednesday.
    expect(localString(addBusinessHours(from, 3, withHoliday, "UTC"), "UTC")).toBe(
      "2026-06-17 10:00",
    );
  });
});

describe("addBusinessHours — tenant timezone, not server timezone", () => {
  it("computes in the tenant's zone", () => {
    const from = at("2026-06-15 09:00", "Europe/Berlin");
    const due = addBusinessHours(from, 4, MON_FRI, "Europe/Berlin");
    expect(localString(due, "Europe/Berlin")).toBe("2026-06-15 13:00");
  });

  it("gives the same wall-clock answer in two zones for the same local input", () => {
    const berlin = addBusinessHours(at("2026-06-15 09:00", "Europe/Berlin"), 4, MON_FRI, "Europe/Berlin");
    const tokyo = addBusinessHours(at("2026-06-15 09:00", "Asia/Tokyo"), 4, MON_FRI, "Asia/Tokyo");

    expect(localString(berlin, "Europe/Berlin")).toBe("2026-06-15 13:00");
    expect(localString(tokyo, "Asia/Tokyo")).toBe("2026-06-15 13:00");
    // Same wall clock, different instants — which is the whole point.
    expect(berlin.getTime()).not.toBe(tokyo.getTime());
  });

  it("handles a zone with a non-hour offset", () => {
    const from = at("2026-06-15 09:00", "Asia/Kolkata"); // UTC+05:30
    expect(localString(addBusinessHours(from, 4, MON_FRI, "Asia/Kolkata"), "Asia/Kolkata")).toBe(
      "2026-06-15 13:00",
    );
  });
});

describe("addBusinessHours — DST transitions (08 §1.2)", () => {
  // Europe/Berlin springs forward 2026-03-29 02:00→03:00, falls back
  // 2026-10-25 03:00→02:00. Both land on a Sunday, so with a Mon–Fri
  // configuration the transition sits between Friday's close and Monday's
  // open — the case where naive UTC arithmetic drifts an hour.
  it("keeps the wall-clock due time across a spring-forward weekend", () => {
    const from = at("2026-03-27 16:00", "Europe/Berlin"); // Friday, 1h left
    // 3h: 1h Friday, then 2h Monday → Monday 10:00 local, DST notwithstanding.
    const due = addBusinessHours(from, 3, MON_FRI, "Europe/Berlin");
    expect(localString(due, "Europe/Berlin")).toBe("2026-03-30 10:00");
  });

  it("keeps the wall-clock due time across a fall-back weekend", () => {
    const from = at("2026-10-23 16:00", "Europe/Berlin"); // Friday, 1h left
    const due = addBusinessHours(from, 3, MON_FRI, "Europe/Berlin");
    expect(localString(due, "Europe/Berlin")).toBe("2026-10-26 10:00");
  });

  it("does the same across the US spring-forward weekend", () => {
    // America/New_York springs forward 2026-03-08 02:00→03:00 (a Sunday).
    const from = at("2026-03-06 16:00", "America/New_York"); // Friday
    const due = addBusinessHours(from, 3, MON_FRI, "America/New_York");
    expect(localString(due, "America/New_York")).toBe("2026-03-09 10:00");
  });

  it("does the same across the US fall-back weekend", () => {
    // 2026-11-01 02:00→01:00 (a Sunday).
    const from = at("2026-10-30 16:00", "America/New_York"); // Friday
    const due = addBusinessHours(from, 3, MON_FRI, "America/New_York");
    expect(localString(due, "America/New_York")).toBe("2026-11-02 10:00");
  });

  // These two put the transition INSIDE a working window, which is the case
  // where a window is genuinely not the length its wall clock suggests.
  const NIGHT_SHIFT: BusinessHours = {
    days: [0, 1, 2, 3, 4, 5, 6],
    start: "00:00",
    end: "12:00",
  };

  it("treats a spring-forward window as one hour SHORTER of real time", () => {
    // 2026-03-29 00:00–12:00 Berlin contains the 02:00→03:00 skip, so it is
    // 11 elapsed hours, not 12. Consuming 12 must therefore spill into the
    // next day rather than finishing at noon.
    const from = at("2026-03-29 00:00", "Europe/Berlin");
    const due = addBusinessHours(from, 12, NIGHT_SHIFT, "Europe/Berlin");
    expect(localString(due, "Europe/Berlin")).toBe("2026-03-30 01:00");
  });

  it("treats a fall-back window as one hour LONGER of real time", () => {
    // 2026-10-25 00:00–12:00 Berlin contains the 03:00→02:00 repeat, so it is
    // 13 elapsed hours; 12 hours of work finishes before noon.
    const from = at("2026-10-25 00:00", "Europe/Berlin");
    const due = addBusinessHours(from, 12, NIGHT_SHIFT, "Europe/Berlin");
    expect(localString(due, "Europe/Berlin")).toBe("2026-10-25 11:00");
  });
});

describe("computeDueAt", () => {
  const config: SlaConfigByPriority = {
    critical: { respondHours: 4, resolveHours: 24, businessHours: MON_FRI },
    major: { respondHours: 8, resolveHours: 72, businessHours: MON_FRI },
    minor: { respondHours: 24, resolveHours: 168, businessHours: MON_FRI },
  };

  it("uses the resolve window for the given priority", () => {
    const now = at("2026-06-15 08:00", "UTC"); // Monday
    // 24 business hours at 9h/day → Mon 9, Tue 9, Wed 6 → Wed 14:00.
    expect(localString(computeDueAt(now, "critical", config, "UTC"), "UTC")).toBe(
      "2026-06-17 14:00",
    );
  });

  it("gives a later date for a lower priority", () => {
    const now = at("2026-06-15 08:00", "UTC");
    const critical = computeDueAt(now, "critical", config, "UTC");
    const minor = computeDueAt(now, "minor", config, "UTC");
    expect(minor.getTime()).toBeGreaterThan(critical.getTime());
  });
});

describe("computeSlaState", () => {
  const start = at("2026-06-15 08:00", "UTC"); // Monday
  const due = at("2026-06-16 08:00", "UTC"); // Tuesday — 9 business hours away

  it("is on_track early in the window", () => {
    expect(computeSlaState(at("2026-06-15 09:00", "UTC"), start, due, MON_FRI, "UTC")).toBe(
      "on_track",
    );
  });

  it("is at_risk past the threshold", () => {
    // 8 of 9 business hours consumed = 89% ≥ 80%.
    expect(computeSlaState(at("2026-06-15 16:00", "UTC"), start, due, MON_FRI, "UTC")).toBe(
      "at_risk",
    );
  });

  it("is breached once the due instant passes", () => {
    expect(computeSlaState(at("2026-06-16 09:00", "UTC"), start, due, MON_FRI, "UTC")).toBe(
      "breached",
    );
  });

  it("does not drift to at_risk over a closed weekend", () => {
    // Raised Friday 16:00, due Monday 12:00. By Sunday almost no business
    // time has passed, so a wall-clock implementation would wrongly panic.
    const friday = at("2026-06-19 16:00", "UTC");
    const monday = at("2026-06-22 12:00", "UTC");
    const sunday = at("2026-06-21 12:00", "UTC");
    expect(computeSlaState(sunday, friday, monday, MON_FRI, "UTC")).toBe("on_track");
  });
});

describe("businessHoursBetween", () => {
  it("counts only time inside working windows", () => {
    const from = at("2026-06-15 16:00", "UTC"); // Monday, 1h left
    const to = at("2026-06-16 10:00", "UTC"); // Tuesday, 2h in
    expect(businessHoursBetween(from, to, MON_FRI, "UTC")).toBeCloseTo(3, 5);
  });

  it("counts a weekend as zero", () => {
    const sat = at("2026-06-20 08:00", "UTC");
    const sun = at("2026-06-21 18:00", "UTC");
    expect(businessHoursBetween(sat, sun, MON_FRI, "UTC")).toBe(0);
  });

  it("returns 0 when the range is inverted", () => {
    const a = at("2026-06-16 10:00", "UTC");
    const b = at("2026-06-15 10:00", "UTC");
    expect(businessHoursBetween(a, b, MON_FRI, "UTC")).toBe(0);
  });
});

describe("configuration errors fail loudly", () => {
  it("rejects business hours with no working days", () => {
    expect(() => addBusinessHours(new Date(), 1, { ...MON_FRI, days: [] }, "UTC")).toThrow(
      /no working days/i,
    );
  });

  it("rejects an end time at or before the start", () => {
    expect(() =>
      addBusinessHours(new Date(), 1, { ...MON_FRI, start: "17:00", end: "08:00" }, "UTC"),
    ).toThrow(/must be after start/i);
  });

  it("rejects a malformed time", () => {
    expect(() => addBusinessHours(new Date(), 1, { ...MON_FRI, start: "8am" }, "UTC")).toThrow(
      /expected "HH:MM"/,
    );
  });

  it("rejects negative hours", () => {
    expect(() => addBusinessHours(new Date(), -1, MON_FRI, "UTC")).toThrow(/non-negative/i);
  });
});
