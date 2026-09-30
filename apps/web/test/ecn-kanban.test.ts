import { describe, expect, it } from "vitest";
import type { EcnStage } from "@kaenal/types";
import { canActOnEcnColumn, ecnColumnCapability, ecnDropAction, nextEcnStage } from "@/lib/ecn-kanban";

/**
 * SPRINT-06 E2's Kanban drag-and-drop legality (DESIGN-06 §4.6) — genuinely
 * new interaction design, no precedent elsewhere in this app's board views.
 * Covered at the pure-function level (this app's vitest setup is node-only,
 * no jsdom, per `link-picker.test.ts`'s own precedent) rather than by
 * mounting the drag-and-drop board.
 */
describe("nextEcnStage", () => {
  it("returns the immediately-next stage for each of the 5 gated stages", () => {
    expect(nextEcnStage("feasibility")).toBe("risk_review");
    expect(nextEcnStage("risk_review")).toBe("ppap");
    expect(nextEcnStage("ppap")).toBe("cab_approval");
    expect(nextEcnStage("cab_approval")).toBe("pilot");
    expect(nextEcnStage("pilot")).toBe("implementation");
  });

  it("returns null for implementation (the last ordered stage) and the two terminal outcomes", () => {
    expect(nextEcnStage("implementation")).toBeNull();
    expect(nextEcnStage("closed")).toBeNull();
    expect(nextEcnStage("rejected")).toBeNull();
  });
});

describe("ecnDropAction", () => {
  it("Draft → Feasibility is submit; Draft → Rejected is withdraw", () => {
    expect(ecnDropAction("draft", "feasibility")).toBe("submit");
    expect(ecnDropAction("draft", "rejected")).toBe("withdraw");
  });

  it("each of the 5 gated stages → its own immediate next stage is approve", () => {
    expect(ecnDropAction("feasibility", "risk_review")).toBe("approve");
    expect(ecnDropAction("risk_review", "ppap")).toBe("approve");
    expect(ecnDropAction("ppap", "cab_approval")).toBe("approve");
    expect(ecnDropAction("cab_approval", "pilot")).toBe("approve");
    expect(ecnDropAction("pilot", "implementation")).toBe("approve");
  });

  it("any of the 5 gated stages → Rejected is reject", () => {
    for (const stage of ["feasibility", "risk_review", "ppap", "cab_approval", "pilot"] as const) {
      expect(ecnDropAction(stage, "rejected")).toBe("reject");
    }
  });

  it("Implementation → Closed is close", () => {
    expect(ecnDropAction("implementation", "closed")).toBe("close");
  });

  it("Rejected → Draft is resubmit — the one legal outgoing drag from Rejected", () => {
    expect(ecnDropAction("rejected", "draft")).toBe("resubmit");
  });

  it("Closed has no outgoing drag at all, to anywhere", () => {
    const targets: EcnStage[] = ["draft", "feasibility", "risk_review", "ppap", "cab_approval", "pilot", "implementation", "rejected"];
    for (const to of targets) expect(ecnDropAction("closed", to)).toBeNull();
  });

  it("Rejected has no other legal outgoing drag besides Draft", () => {
    const targets: EcnStage[] = ["feasibility", "risk_review", "ppap", "cab_approval", "pilot", "implementation", "closed"];
    for (const to of targets) expect(ecnDropAction("rejected", to)).toBeNull();
  });

  it("rejects a non-adjacent gated-stage drop (skipping a gate)", () => {
    expect(ecnDropAction("feasibility", "ppap")).toBeNull();
    expect(ecnDropAction("feasibility", "cab_approval")).toBeNull();
  });

  it("rejects dropping a card on its own current column", () => {
    expect(ecnDropAction("draft", "draft")).toBeNull();
    expect(ecnDropAction("feasibility", "feasibility")).toBeNull();
  });

  it("rejects Draft trying to skip straight past Feasibility", () => {
    expect(ecnDropAction("draft", "risk_review")).toBeNull();
    expect(ecnDropAction("draft", "implementation")).toBeNull();
    expect(ecnDropAction("draft", "closed")).toBeNull();
  });

  it("rejects Implementation going anywhere but Closed", () => {
    expect(ecnDropAction("implementation", "rejected")).toBeNull();
    expect(ecnDropAction("implementation", "draft")).toBeNull();
  });
});

describe("ecnColumnCapability / canActOnEcnColumn", () => {
  it("the 5 gated columns need ecn:approve", () => {
    for (const stage of ["feasibility", "risk_review", "ppap", "cab_approval", "pilot"] as const) {
      expect(ecnColumnCapability(stage)).toBe("ecn:approve");
    }
  });

  it("Draft/Implementation/Rejected need ecn:manage", () => {
    expect(ecnColumnCapability("draft")).toBe("ecn:manage");
    expect(ecnColumnCapability("implementation")).toBe("ecn:manage");
    expect(ecnColumnCapability("rejected")).toBe("ecn:manage");
  });

  it("Closed needs nothing — no outgoing action for anyone", () => {
    expect(ecnColumnCapability("closed")).toBeNull();
    expect(canActOnEcnColumn("closed", { canManage: true, canApprove: true })).toBe(false);
  });

  it("an ecn:manage-only holder (e.g. auditor) can act on Draft but not on a gated column", () => {
    const caps = { canManage: true, canApprove: false };
    expect(canActOnEcnColumn("draft", caps)).toBe(true);
    expect(canActOnEcnColumn("rejected", caps)).toBe(true);
    expect(canActOnEcnColumn("feasibility", caps)).toBe(false);
  });

  it("an ecn:approve holder (admin/manager) can act on a gated column but not, via that capability alone, on Draft", () => {
    const caps = { canManage: false, canApprove: true };
    expect(canActOnEcnColumn("feasibility", caps)).toBe(true);
    expect(canActOnEcnColumn("draft", caps)).toBe(false);
  });

  it("a viewer holding neither capability can act on nothing", () => {
    const caps = { canManage: false, canApprove: false };
    for (const stage of ["draft", "feasibility", "risk_review", "ppap", "cab_approval", "pilot", "implementation", "closed", "rejected"] as const) {
      expect(canActOnEcnColumn(stage, caps)).toBe(false);
    }
  });
});
