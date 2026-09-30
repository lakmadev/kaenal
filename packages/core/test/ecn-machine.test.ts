import { EcnStage } from "@kaenal/types";
import { describe, expect, it } from "vitest";
import {
  ECN_GATED_STAGES,
  ECN_STAGE_ORDER,
  ecnMachine,
  ecnStageIndex,
  isEcnGatedStage,
  type EcnTransitionContext,
} from "../src/index.js";

/**
 * ECN state machine coverage (SPRINT-06 §3.2, §0b D1/D3) — the full
 * transition matrix, both legal and illegal, plus the four-eyes/approver-role
 * guards. Mirrors `state-machines.test.ts`'s established style for
 * `documentMachine`/`ncrMachine`.
 */

const OWNER = "user-owner";
const CREATOR = "user-creator";
const OTHER = "user-other";

const ctx = (over: Partial<EcnTransitionContext> = {}): EcnTransitionContext => ({
  actorId: OTHER,
  actorRole: "manager",
  ownerId: OWNER,
  createdById: CREATOR,
  ...over,
});

describe("ECN state machine — full matrix", () => {
  const legal: Record<string, readonly EcnStage[]> = {
    draft: ["feasibility", "rejected"],
    feasibility: ["risk_review", "rejected"],
    risk_review: ["ppap", "rejected"],
    ppap: ["cab_approval", "rejected"],
    cab_approval: ["pilot", "rejected"],
    pilot: ["implementation", "rejected"],
    implementation: ["closed"],
    closed: [],
    rejected: ["draft"],
  };

  const pairs = EcnStage.values.flatMap((from) => EcnStage.values.map((to) => [from, to] as const));

  it.each(pairs)("%s → %s matches the canonical graph", (from, to) => {
    const expected = from !== to && (legal[from] ?? []).includes(to);
    const decision = ecnMachine.canTransition(from, to, ctx());
    expect(decision.ok, `${from} → ${to} should be ${expected ? "legal" : "illegal"}`).toBe(expected);
  });

  it("treats closed as the only fully terminal stage", () => {
    expect(ecnMachine.isTerminal("closed")).toBe(true);
    expect(ecnMachine.isTerminal("rejected")).toBe(false);
    expect(ecnMachine.isTerminal("draft")).toBe(false);
  });

  it("reports the allowed next stages on an illegal transition", () => {
    const decision = ecnMachine.canTransition("draft", "ppap", ctx());
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.code).toBe("INVALID_TRANSITION");
    expect(decision.details?.["allowed"]).toEqual(["feasibility", "rejected"]);
  });
});

describe("ECN_STAGE_ORDER / ecnStageIndex (§2 E1 AC2)", () => {
  it("has exactly 7 ordered stages, ppap the 4th", () => {
    expect(ECN_STAGE_ORDER).toHaveLength(7);
    expect(ECN_STAGE_ORDER[3]).toBe("ppap");
    expect(ECN_STAGE_ORDER).toEqual([
      "draft",
      "feasibility",
      "risk_review",
      "ppap",
      "cab_approval",
      "pilot",
      "implementation",
    ]);
  });

  it("returns 1-7 for the ordered stages", () => {
    expect(ecnStageIndex("draft")).toBe(1);
    expect(ecnStageIndex("ppap")).toBe(4);
    expect(ecnStageIndex("implementation")).toBe(7);
  });

  it("returns null for the two terminal/backward outcomes", () => {
    expect(ecnStageIndex("closed")).toBeNull();
    expect(ecnStageIndex("rejected")).toBeNull();
  });
});

describe("ECN_GATED_STAGES / isEcnGatedStage (§0b D1)", () => {
  it("names exactly the 5 human-approval gates, incl. ppap", () => {
    expect(ECN_GATED_STAGES).toEqual(["feasibility", "risk_review", "ppap", "cab_approval", "pilot"]);
  });

  it.each(EcnStage.values)("%s gated iff it is one of the 5", (stage) => {
    expect(isEcnGatedStage(stage)).toBe(ECN_GATED_STAGES.includes(stage));
  });
});

describe("ECN guard: only admin/manager decide a gated stage (§3.2, Q30)", () => {
  it.each(["auditor", "inspector", "viewer"] as const)(
    "refuses %s approving out of a gated stage",
    (role) => {
      const decision = ecnMachine.canTransition("feasibility", "risk_review", ctx({ actorRole: role }));
      expect(decision.ok).toBe(false);
      if (!decision.ok) expect(decision.code).toBe("FORBIDDEN");
    },
  );

  it("allows manager to decide a gated stage", () => {
    expect(ecnMachine.canTransition("ppap", "cab_approval", ctx({ actorRole: "manager" })).ok).toBe(true);
  });

  it("does NOT require admin/manager for submit (draft→feasibility, ecn:manage territory)", () => {
    const decision = ecnMachine.canTransition("draft", "feasibility", ctx({ actorRole: "auditor" }));
    expect(decision.ok).toBe(true);
  });

  it("does NOT require admin/manager for withdraw (draft→rejected)", () => {
    expect(ecnMachine.canTransition("draft", "rejected", ctx({ actorRole: "inspector" })).ok).toBe(true);
  });

  it("does NOT require admin/manager for close (implementation→closed)", () => {
    expect(ecnMachine.canTransition("implementation", "closed", ctx({ actorRole: "auditor" })).ok).toBe(
      true,
    );
  });

  it("does NOT require admin/manager for resubmit (rejected→draft, §0b D3)", () => {
    expect(ecnMachine.canTransition("rejected", "draft", ctx({ actorRole: "inspector" })).ok).toBe(true);
  });
});

describe("ECN guard: four-eyes, stricter than documents (§0 B2)", () => {
  it("blocks the owner from approving a gated stage", () => {
    const decision = ecnMachine.canTransition(
      "feasibility",
      "risk_review",
      ctx({ actorId: OWNER, createdById: CREATOR }),
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.details?.["requires"]).toBe("four_eyes");
  });

  it("blocks the creator (not the owner) from approving a gated stage", () => {
    const decision = ecnMachine.canTransition("feasibility", "risk_review", ctx({ actorId: CREATOR }));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.details?.["requires"]).toBe("four_eyes");
  });

  it("blocks the owner from REJECTING a gated stage too (stricter than documentMachine)", () => {
    const decision = ecnMachine.canTransition("pilot", "rejected", ctx({ actorId: OWNER }));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.details?.["requires"]).toBe("four_eyes");
  });

  it("allows a third party to decide", () => {
    expect(
      ecnMachine.canTransition("feasibility", "risk_review", ctx({ actorId: OTHER })).ok,
    ).toBe(true);
  });

  it("treats a null createdById as never matching the actor (IS DISTINCT FROM semantics)", () => {
    const decision = ecnMachine.canTransition(
      "feasibility",
      "risk_review",
      ctx({ actorId: OTHER, createdById: null }),
    );
    expect(decision.ok).toBe(true);
  });

  it("does not restrict who may resubmit — owner and creator may call it themselves (§0b D3a)", () => {
    expect(ecnMachine.canTransition("rejected", "draft", ctx({ actorId: OWNER })).ok).toBe(true);
    expect(ecnMachine.canTransition("rejected", "draft", ctx({ actorId: CREATOR })).ok).toBe(true);
  });

  it("does not restrict who may withdraw their own draft", () => {
    expect(ecnMachine.canTransition("draft", "rejected", ctx({ actorId: OWNER })).ok).toBe(true);
  });
});
