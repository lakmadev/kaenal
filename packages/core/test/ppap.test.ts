import { describe, expect, it } from "vitest";
import {
  PPAP_ELEMENTS,
  PSW_ELEMENT_ID,
  seedPpapElements,
  ppapCompleteness,
  isPpapApprovable,
  ppapDaysOpen,
  type PpapElementState,
} from "../src/ppap.js";

/** All 18 elements at one status — a helper for the completeness matrix. */
function allAt(status: PpapElementState["status"]): PpapElementState[] {
  return PPAP_ELEMENTS.map((e) => ({ id: e.id, status }));
}

describe("PPAP canonical elements", () => {
  it("has exactly 18 elements numbered 1..18", () => {
    expect(PPAP_ELEMENTS).toHaveLength(18);
    expect(PPAP_ELEMENTS.map((e) => e.id)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it("makes element 18 the PSW", () => {
    expect(PSW_ELEMENT_ID).toBe(18);
    expect(PPAP_ELEMENTS[17]?.name).toContain("PSW");
  });

  it("seeds all 18 as pending", () => {
    const seeded = seedPpapElements();
    expect(seeded).toHaveLength(18);
    expect(seeded.every((e) => e.status === "pending")).toBe(true);
  });
});

describe("ppapCompleteness / approvability", () => {
  it("is not approvable while any element is pending", () => {
    const c = ppapCompleteness(allAt("pending"));
    expect(c.required).toBe(18);
    expect(c.approved).toBe(0);
    expect(c.outstanding).toBe(18);
    expect(c.approvable).toBe(false);
  });

  it("is not approvable with a single changes_requested element", () => {
    const els = allAt("approved");
    els[5] = { id: 6, status: "changes_requested" };
    expect(isPpapApprovable(els)).toBe(false);
    expect(ppapCompleteness(els).outstanding).toBe(1);
  });

  it("is approvable when every element is approved", () => {
    expect(isPpapApprovable(allAt("approved"))).toBe(true);
  });

  it("excludes N/A elements from the denominator", () => {
    // 17 approved + 1 N/A → approvable, and the N/A is not counted as required.
    const els = allAt("approved");
    els[12] = { id: 13, status: "n_a" }; // Appearance Approval Report often waived
    const c = ppapCompleteness(els);
    expect(c.required).toBe(17);
    expect(c.approved).toBe(17);
    expect(c.approvable).toBe(true);
  });

  it("is not approvable when every element is N/A (nothing to warrant)", () => {
    expect(isPpapApprovable(allAt("n_a"))).toBe(false);
  });

  it("is not approvable with no elements", () => {
    expect(isPpapApprovable([])).toBe(false);
  });
});

describe("ppapDaysOpen", () => {
  it("counts whole days from the submitted date", () => {
    const now = new Date("2026-04-19T00:00:00Z");
    expect(ppapDaysOpen("2026-04-10", now)).toBe(9);
  });

  it("never goes negative for a future submitted date", () => {
    const now = new Date("2026-04-10T00:00:00Z");
    expect(ppapDaysOpen("2026-04-20", now)).toBe(0);
  });

  it("returns null when there is no submitted date", () => {
    expect(ppapDaysOpen(null)).toBeNull();
    expect(ppapDaysOpen(undefined)).toBeNull();
    expect(ppapDaysOpen("")).toBeNull();
  });
});
