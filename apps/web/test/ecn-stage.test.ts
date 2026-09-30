import { describe, expect, it } from "vitest";
import { ECN_KANBAN_COLUMNS, STAGE_LABEL, stageProgress } from "@/lib/ecn-stage";

describe("ECN_KANBAN_COLUMNS", () => {
  it("has all 9 columns, in board order (DESIGN-06 §0/§4.6 — ppap and rejected both real columns)", () => {
    expect(ECN_KANBAN_COLUMNS).toEqual([
      "draft",
      "feasibility",
      "risk_review",
      "ppap",
      "cab_approval",
      "pilot",
      "implementation",
      "closed",
      "rejected",
    ]);
  });

  it("every column has a label", () => {
    for (const stage of ECN_KANBAN_COLUMNS) {
      expect(STAGE_LABEL[stage]).toBeTruthy();
    }
  });
});

describe("stageProgress", () => {
  it("reports step X of 7 for each of the 7 ordered pipeline stages (§0b D1's ppap insertion)", () => {
    expect(stageProgress("draft")).toEqual({ step: 1, of: 7 });
    expect(stageProgress("feasibility")).toEqual({ step: 2, of: 7 });
    expect(stageProgress("risk_review")).toEqual({ step: 3, of: 7 });
    expect(stageProgress("ppap")).toEqual({ step: 4, of: 7 });
    expect(stageProgress("cab_approval")).toEqual({ step: 5, of: 7 });
    expect(stageProgress("pilot")).toEqual({ step: 6, of: 7 });
    expect(stageProgress("implementation")).toEqual({ step: 7, of: 7 });
  });

  it("is null for the two terminal outcomes, which sit outside the 'of 7' count", () => {
    expect(stageProgress("closed")).toBeNull();
    expect(stageProgress("rejected")).toBeNull();
  });
});
