import { describe, expect, it } from "vitest";
import {
  SCAR_D_STEPS,
  FIRST_D,
  LAST_D,
  isFinalD,
  nextD,
  isScarActive,
  scarIsOverdue,
  scarStageLabel,
  scarDaysOpen,
  canTransitionChargeback,
  type ScarStatus,
} from "../src/scar.js";

/**
 * SCAR domain rules (FEATURES §11.3, P10). The 8D step machine is forward-only;
 * overdue and days-open are derived; chargeback transitions are a one-way ratchet.
 */

describe("the 8D step ladder", () => {
  it("is D1..D8 in order", () => {
    expect(SCAR_D_STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(FIRST_D).toBe(1);
    expect(LAST_D).toBe(8);
  });

  it("advances forward one step", () => {
    expect(nextD(1)).toBe(2);
    expect(nextD(4)).toBe(5);
    expect(nextD(7)).toBe(8);
  });

  it("cannot advance past D8", () => {
    expect(isFinalD(8)).toBe(true);
    expect(isFinalD(7)).toBe(false);
    expect(() => nextD(8)).toThrow(/D8/);
  });

  it("rejects out-of-range steps", () => {
    expect(() => nextD(0)).toThrow(/Invalid/);
    expect(() => nextD(9)).toThrow(/Invalid/);
    expect(() => nextD(3.5)).toThrow(/Invalid/);
  });
});

describe("active vs terminal lifecycle", () => {
  it("draft/open/responded are active", () => {
    for (const s of ["draft", "open", "responded"] as ScarStatus[]) expect(isScarActive(s)).toBe(true);
  });
  it("closed/rejected/cancelled are terminal", () => {
    for (const s of ["closed", "rejected", "cancelled"] as ScarStatus[]) expect(isScarActive(s)).toBe(false);
  });
});

describe("overdue is derived, never stored", () => {
  const now = new Date("2026-04-20T12:00:00Z");

  it("is overdue when an active SCAR's response-due date has passed", () => {
    expect(scarIsOverdue({ status: "open", supplierResponseDue: "2026-04-12" }, now)).toBe(true);
  });

  it("prefers supplier-response-due over the overall due date", () => {
    expect(
      scarIsOverdue({ status: "open", supplierResponseDue: "2026-04-12", dueDate: "2026-04-30" }, now),
    ).toBe(true);
  });

  it("falls back to the overall due date when there is no response-due", () => {
    expect(scarIsOverdue({ status: "open", dueDate: "2026-04-10" }, now)).toBe(true);
    expect(scarIsOverdue({ status: "open", dueDate: "2026-04-30" }, now)).toBe(false);
  });

  it("is not overdue on the due date itself (date-only, today is fine)", () => {
    expect(scarIsOverdue({ status: "open", supplierResponseDue: "2026-04-20" }, now)).toBe(false);
  });

  it("is never overdue once closed / rejected / cancelled", () => {
    for (const s of ["closed", "rejected", "cancelled"] as ScarStatus[]) {
      expect(scarIsOverdue({ status: s, supplierResponseDue: "2026-01-01" }, now)).toBe(false);
    }
  });

  it("is not overdue with no dates", () => {
    expect(scarIsOverdue({ status: "open" }, now)).toBe(false);
    expect(scarIsOverdue({ status: "open", supplierResponseDue: null, dueDate: null }, now)).toBe(false);
  });
});

describe("stage label composition (mirrors awaiting_d4 / d5_review)", () => {
  it("renders an active SCAR as its current discipline", () => {
    expect(scarStageLabel("open", 4)).toBe("D4 · Root Cause");
    expect(scarStageLabel("responded", 5)).toBe("D5 · Corrective Actions");
  });
  it("renders a terminal SCAR as its status", () => {
    expect(scarStageLabel("closed", 8)).toBe("closed");
    expect(scarStageLabel("rejected", 3)).toBe("rejected");
  });
});

describe("days open", () => {
  const now = new Date("2026-04-20T00:00:00Z");
  it("counts whole days from the raised date", () => {
    expect(scarDaysOpen("2026-04-09", now)).toBe(11);
  });
  it("never goes negative", () => {
    expect(scarDaysOpen("2026-05-01", now)).toBe(0);
  });
  it("is null without a raised date", () => {
    expect(scarDaysOpen(null, now)).toBeNull();
    expect(scarDaysOpen(undefined, now)).toBeNull();
    expect(scarDaysOpen("", now)).toBeNull();
  });
});

describe("chargeback is a one-way ratchet", () => {
  it("raises from none into pending only", () => {
    expect(canTransitionChargeback(null, "pending")).toBe(true);
    expect(canTransitionChargeback(null, "debit_issued")).toBe(false);
    expect(canTransitionChargeback(null, "closed")).toBe(false);
  });
  it("moves forward pending → debit_issued → closed", () => {
    expect(canTransitionChargeback("pending", "debit_issued")).toBe(true);
    expect(canTransitionChargeback("debit_issued", "closed")).toBe(true);
  });
  it("never moves backward or skips", () => {
    expect(canTransitionChargeback("debit_issued", "pending")).toBe(false);
    expect(canTransitionChargeback("closed", "debit_issued")).toBe(false);
    expect(canTransitionChargeback("pending", "closed")).toBe(false);
  });
  it("is a no-op to the same status", () => {
    expect(canTransitionChargeback("pending", "pending")).toBe(false);
    expect(canTransitionChargeback("closed", "closed")).toBe(false);
  });
});
