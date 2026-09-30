import { describe, expect, it } from "vitest";
import {
  AT_RISK_THRESHOLD,
  COMPLAINT_SLA_MATRIX,
  complaintSlaState,
  complaintSlaTargetsFor,
  type ComplaintSlaInput,
} from "../src/index.js";

/**
 * Complaint SLA math (SPRINT-06 §3.1, corrected §0 B7) — a plain
 * elapsed-hours comparison (never `computeDueAt`'s business-hours
 * machinery, §0 B7d), the shared 0.8 `AT_RISK_THRESHOLD`, and the
 * freeze-at-close/freeze-at-acknowledge rules (§0 B7b).
 */

const RECEIVED = "2026-06-01T00:00:00.000Z";

const base = (over: Partial<ComplaintSlaInput> = {}): ComplaintSlaInput => ({
  slaTargetHours: 24,
  receivedAt: RECEIVED,
  acknowledgedAt: null,
  closedAt: null,
  now: RECEIVED,
  ...over,
});

describe("COMPLAINT_SLA_MATRIX — the fixed 1h/4h/24h/48h ack, 14/21/45/90d close table", () => {
  it("matches the sprint's approved matrix exactly", () => {
    expect(COMPLAINT_SLA_MATRIX).toEqual({
      critical: { ackHours: 1, closeDays: 14 },
      high: { ackHours: 4, closeDays: 21 },
      medium: { ackHours: 24, closeDays: 45 },
      low: { ackHours: 48, closeDays: 90 },
    });
  });

  it("complaintSlaTargetsFor looks up by severity", () => {
    expect(complaintSlaTargetsFor("critical")).toEqual({ ackHours: 1, closeDays: 14 });
    expect(complaintSlaTargetsFor("low")).toEqual({ ackHours: 48, closeDays: 90 });
  });
});

describe("complaintSlaState — reuses the existing 0.8 AT_RISK_THRESHOLD, not a second constant", () => {
  it("the imported constant is 0.8 (§0 B7d)", () => {
    expect(AT_RISK_THRESHOLD).toBe(0.8);
  });
});

describe("complaintSlaState — not yet acknowledged", () => {
  it("is on_track well within the window", () => {
    const state = complaintSlaState(
      base({ now: "2026-06-01T05:00:00.000Z" }), // 5h of 24h
    );
    expect(state).toBe("on_track");
  });

  it("is at_risk just at/past the 0.8 boundary", () => {
    // 24h target × 0.8 = 19.2h elapsed — one minute past to sidestep float
    // rounding right at the exact boundary.
    const state = complaintSlaState(base({ now: "2026-06-01T19:13:00.000Z" }));
    expect(state).toBe("at_risk");
  });

  it("is on_track just under the 0.8 boundary", () => {
    const state = complaintSlaState(base({ now: "2026-06-01T19:11:00.000Z" }));
    expect(state).toBe("on_track");
  });

  it("is breached once elapsed hours exceed the target", () => {
    const state = complaintSlaState(base({ now: "2026-06-02T00:00:01.000Z" })); // 24h + 1s
    expect(state).toBe("breached");
  });

  it("is not yet breached exactly at the target boundary", () => {
    const state = complaintSlaState(base({ now: "2026-06-02T00:00:00.000Z" })); // exactly 24h
    expect(state).toBe("at_risk");
  });
});

describe("complaintSlaState — acknowledged: fixed forever at ack-time outcome (§0 B7b)", () => {
  it("stays on_track forever once acknowledged within target, regardless of later now", () => {
    const state = complaintSlaState(
      base({
        acknowledgedAt: "2026-06-01T02:00:00.000Z", // 2h, well within 24h
        now: "2026-06-10T00:00:00.000Z", // long after
      }),
    );
    expect(state).toBe("on_track");
  });

  it("is permanently breached if the first response itself was late — a late ack never recovers", () => {
    const state = complaintSlaState(
      base({
        acknowledgedAt: "2026-06-02T01:00:00.000Z", // 25h, past the 24h target
        now: "2026-06-20T00:00:00.000Z",
      }),
    );
    expect(state).toBe("breached");
  });

  it("acknowledged exactly at the target boundary is on_track (within, not exceeding)", () => {
    const state = complaintSlaState(
      base({ acknowledgedAt: "2026-06-02T00:00:00.000Z" }), // exactly 24h
    );
    expect(state).toBe("on_track");
  });
});

describe("complaintSlaState — closed: frozen at closing time, never recomputed (§0 B7b)", () => {
  it("freezes an unacknowledged-then-closed complaint's state at closedAt, not at the real now", () => {
    // Closed 5h after receipt (well within the 24h target) but read long after.
    const state = complaintSlaState(
      base({
        closedAt: "2026-06-01T05:00:00.000Z",
        now: "2026-12-01T00:00:00.000Z",
      }),
    );
    expect(state).toBe("on_track");
  });

  it("freezes a breached-then-closed complaint as breached forever, not re-derived against now", () => {
    const state = complaintSlaState(
      base({
        closedAt: "2026-06-05T00:00:00.000Z", // closed 4 days late, unacknowledged
        now: "2027-01-01T00:00:00.000Z",
      }),
    );
    expect(state).toBe("breached");
  });

  it("an acknowledged-then-closed complaint uses the ack-time outcome, not the close time", () => {
    const state = complaintSlaState(
      base({
        acknowledgedAt: "2026-06-01T02:00:00.000Z", // on time
        closedAt: "2026-06-10T00:00:00.000Z", // closed much later, irrelevant here
        now: "2027-01-01T00:00:00.000Z",
      }),
    );
    expect(state).toBe("on_track");
  });
});
