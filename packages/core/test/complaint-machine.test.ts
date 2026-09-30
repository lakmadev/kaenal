import { ComplaintSeverity, ComplaintStatus } from "@kaenal/types";
import { describe, expect, it } from "vitest";
import {
  advanceComplaintStatus,
  COMPLAINT_STATUS_RANK,
  complaintMachine,
  complaintSeverityToNcrPriority,
  complaintSeverityToWizardPriority,
  complaintStatusRank,
} from "../src/index.js";

describe("complaint status machine — close is the only real transition (§2 C3)", () => {
  const legal: Record<string, readonly ComplaintStatus[]> = {
    triage: ["closed"],
    investigation: ["closed"],
    "8d": ["closed"],
    capa: ["closed"],
    closed: [],
  };

  const pairs = ComplaintStatus.values.flatMap((from) =>
    ComplaintStatus.values.map((to) => [from, to] as const),
  );

  it.each(pairs)("%s → %s matches the specified graph", (from, to) => {
    const expected = from !== to && (legal[from] ?? []).includes(to);
    expect(complaintMachine.canTransition(from, to, {}).ok).toBe(expected);
  });

  it("422s (INVALID_TRANSITION) on closing an already-closed complaint", () => {
    const decision = complaintMachine.canTransition("closed", "closed", {});
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("INVALID_TRANSITION");
  });

  it("closes from any non-closed status, with or without ever converting", () => {
    for (const from of ["triage", "investigation", "8d", "capa"] as const) {
      expect(complaintMachine.canTransition(from, "closed", {}).ok).toBe(true);
    }
  });

  it("treats closed as terminal", () => {
    expect(complaintMachine.isTerminal("closed")).toBe(true);
    expect(complaintMachine.isTerminal("triage")).toBe(false);
  });
});

describe("COMPLAINT_STATUS_RANK / complaintStatusRank (§2 C4 AC2, §0 B8d)", () => {
  it("ranks capa > eight_d > ncr > triage", () => {
    expect(complaintStatusRank("closed")).toBeGreaterThan(complaintStatusRank("capa"));
    expect(complaintStatusRank("capa")).toBeGreaterThan(complaintStatusRank("8d"));
    expect(complaintStatusRank("8d")).toBeGreaterThan(complaintStatusRank("investigation"));
    expect(complaintStatusRank("investigation")).toBeGreaterThan(complaintStatusRank("triage"));
  });

  it("assigns a rank to every status in the enum", () => {
    for (const status of ComplaintStatus.values) {
      expect(Object.keys(COMPLAINT_STATUS_RANK)).toContain(status);
    }
  });
});

describe("advanceComplaintStatus — rank-max, never regresses (§0 B6a/c)", () => {
  it("advances triage → investigation when converting to ncr", () => {
    expect(advanceComplaintStatus("triage", "investigation")).toBe("investigation");
  });

  it("advances triage straight to capa (skip NCR/8D entirely — a real intended path)", () => {
    expect(advanceComplaintStatus("triage", "capa")).toBe("capa");
  });

  it("does NOT regress when converting to a chronologically-earlier target", () => {
    // Converting to NCR on a complaint already at `8d` links the record but
    // must not move status backward (§0 B6c, matches COM-2026-0082/0081's
    // own single-linked-record fixture behaviour).
    expect(advanceComplaintStatus("8d", "investigation")).toBe("8d");
    expect(advanceComplaintStatus("capa", "8d")).toBe("capa");
  });

  it("stays put converting to the same rank again", () => {
    expect(advanceComplaintStatus("investigation", "investigation")).toBe("investigation");
  });
});

describe("severity → priority mapping (§0 B6g)", () => {
  const NCR_TABLE: Record<ComplaintSeverity, string> = {
    critical: "critical",
    high: "major",
    medium: "minor",
    low: "minor",
  };
  const WIZARD_TABLE: Record<ComplaintSeverity, string> = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
  };

  it.each(ComplaintSeverity.values)("%s → NCR/CAPA priority per the stated table", (severity) => {
    expect(complaintSeverityToNcrPriority(severity)).toBe(NCR_TABLE[severity]);
  });

  it.each(ComplaintSeverity.values)("%s → 8D (WizardPriority) per the stated table", (severity) => {
    expect(complaintSeverityToWizardPriority(severity)).toBe(WIZARD_TABLE[severity]);
  });
});
