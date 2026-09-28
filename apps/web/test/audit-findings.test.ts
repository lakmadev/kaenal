import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY } from "@/features/audits/audit-priority-logic";

/**
 * Severity→priority default mapping (S2-5) for the raise-NCR/CAPA mini-forms
 * under a finding card: a major/minor NC pre-fills the higher tier, an
 * opportunity (never a nonconformance) pre-fills the lowest. The form still
 * lets the user override it — this only pins the pre-fill.
 */
describe("DEFAULT_PRIORITY", () => {
  it("maps a major nonconformance to critical", () => {
    expect(DEFAULT_PRIORITY.major_nc).toBe("critical");
  });

  it("maps a minor nonconformance to major", () => {
    expect(DEFAULT_PRIORITY.minor_nc).toBe("major");
  });

  it("maps an opportunity to minor", () => {
    expect(DEFAULT_PRIORITY.opportunity).toBe("minor");
  });

  it("covers exactly the three finding kinds, each with a distinct tier", () => {
    const values = Object.values(DEFAULT_PRIORITY);
    expect(Object.keys(DEFAULT_PRIORITY).sort()).toEqual(["major_nc", "minor_nc", "opportunity"]);
    expect(new Set(values).size).toBe(3);
  });
});
