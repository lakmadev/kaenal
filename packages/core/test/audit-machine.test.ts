import { describe, expect, it } from "vitest";
import { AUDIT_PHASE_ORDER, auditMachine } from "../src/state-machines/audit.js";

describe("audit phase machine (02 §2)", () => {
  it("advances one phase forward through the fixed sequence", () => {
    expect([...AUDIT_PHASE_ORDER]).toEqual(["planned", "preparation", "fieldwork", "reporting", "closed"]);
    expect(auditMachine.canTransition("planned", "preparation", {}).ok).toBe(true);
    expect(auditMachine.canTransition("fieldwork", "reporting", {}).ok).toBe(true);
    expect(auditMachine.canTransition("reporting", "closed", {}).ok).toBe(true);
  });

  it("refuses to skip a phase", () => {
    const skip = auditMachine.canTransition("planned", "fieldwork", {});
    expect(skip.ok).toBe(false);
    if (!skip.ok) expect(skip.details?.["allowed"]).toEqual(["preparation"]);
  });

  it("refuses to move backward", () => {
    expect(auditMachine.canTransition("reporting", "fieldwork", {}).ok).toBe(false);
    expect(auditMachine.canTransition("closed", "reporting", {}).ok).toBe(false);
  });

  it("treats closed as terminal", () => {
    expect(auditMachine.isTerminal("closed")).toBe(true);
    expect(auditMachine.isTerminal("planned")).toBe(false);
  });
});
