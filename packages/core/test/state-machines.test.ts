import { DocumentStatus, InspectionStatus, NcrStatus } from "@kaenal/types";
import { describe, expect, it } from "vitest";
import {
  canRevertCapa,
  capaMachine,
  CAPA_PHASE_ORDER,
  documentMachine,
  inspectionMachine,
  ncrMachine,
  type NcrTransitionContext,
} from "../src/index.js";

/**
 * State machine coverage (08 §1.2): the full transition matrix per entity,
 * legal AND illegal. Generating every (from, to) pair rather than listing
 * happy paths is what catches an edge accidentally added to the graph — the
 * failure mode where a bug makes something MORE permissive, which no
 * happy-path test can see.
 */

const RESOLVER = "user-resolver";
const OTHER = "user-other";

const ncrCtx = (over: Partial<NcrTransitionContext> = {}): NcrTransitionContext => ({
  actions: [{ kind: "corrective", status: "done" }],
  actorId: OTHER,
  actorRole: "manager",
  resolvedBy: RESOLVER,
  openEightDId: null,
  force: false,
  ...over,
});

describe("NCR state machine — full matrix", () => {
  const legal: Record<string, readonly NcrStatus[]> = {
    draft: ["open", "escalated"],
    open: ["assigned", "escalated"],
    assigned: ["in_progress", "escalated"],
    in_progress: ["resolved", "escalated"],
    resolved: ["verified", "in_progress", "escalated"],
    verified: ["closed", "escalated"],
    closed: ["reopened"],
    escalated: ["assigned", "in_progress", "resolved"],
    reopened: ["in_progress", "escalated"],
  };

  const pairs = NcrStatus.values.flatMap((from) =>
    NcrStatus.values.map((to) => [from, to] as const),
  );

  it.each(pairs)("%s → %s matches the specified graph", (from, to) => {
    const expected = from !== to && (legal[from] ?? []).includes(to);
    const decision = ncrMachine.canTransition(from, to, ncrCtx());
    expect(decision.ok, `${from} → ${to} should be ${expected ? "legal" : "illegal"}`).toBe(
      expected,
    );
  });

  it("reports the allowed next states on an illegal transition", () => {
    const decision = ncrMachine.canTransition("closed", "in_progress", ncrCtx());
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.code).toBe("INVALID_TRANSITION");
    // The UI renders its buttons from this list; without it every client would
    // have to hardcode the graph.
    expect(decision.details?.["allowed"]).toEqual(["reopened"]);
  });

  it("rejects a transition to the state it is already in", () => {
    const decision = ncrMachine.canTransition("open", "open", ncrCtx());
    expect(decision.ok).toBe(false);
  });
});

describe("NCR guard: resolution requires a completed corrective action", () => {
  it("blocks resolving with no actions at all", () => {
    const decision = ncrMachine.canTransition("in_progress", "resolved", ncrCtx({ actions: [] }));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.details?.["requires"]).toBe("corrective_action_done");
  });

  it("blocks resolving when the corrective action is still pending", () => {
    const decision = ncrMachine.canTransition(
      "in_progress",
      "resolved",
      ncrCtx({ actions: [{ kind: "corrective", status: "pending" }] }),
    );
    expect(decision.ok).toBe(false);
  });

  it("does not accept a containment action as a substitute for a corrective one", () => {
    const decision = ncrMachine.canTransition(
      "in_progress",
      "resolved",
      ncrCtx({ actions: [{ kind: "containment", status: "done" }] }),
    );
    expect(decision.ok).toBe(false);
  });

  it("accepts a verified corrective action", () => {
    const decision = ncrMachine.canTransition(
      "in_progress",
      "resolved",
      ncrCtx({ actions: [{ kind: "corrective", status: "verified" }] }),
    );
    expect(decision.ok).toBe(true);
  });
});

describe("NCR guard: four-eyes verification (02 §4)", () => {
  it("blocks the resolver from verifying their own work", () => {
    const decision = ncrMachine.canTransition(
      "resolved",
      "verified",
      ncrCtx({ actorId: RESOLVER, resolvedBy: RESOLVER }),
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.details?.["requires"]).toBe("four_eyes");
  });

  it("allows a different user to verify", () => {
    const decision = ncrMachine.canTransition(
      "resolved",
      "verified",
      ncrCtx({ actorId: OTHER, resolvedBy: RESOLVER }),
    );
    expect(decision.ok).toBe(true);
  });

  it("allows verification when no resolver is recorded", () => {
    const decision = ncrMachine.canTransition(
      "resolved",
      "verified",
      ncrCtx({ actorId: OTHER, resolvedBy: null }),
    );
    expect(decision.ok).toBe(true);
  });
});

describe("NCR guard: open 8D blocks closing (03 §10)", () => {
  it("blocks closing and names the blocking 8D", () => {
    const decision = ncrMachine.canTransition(
      "verified",
      "closed",
      ncrCtx({ openEightDId: "8d-123" }),
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("CONFLICT");
      expect(decision.details?.["blockedBy"]).toBe("8d-123");
    }
  });

  it("lets a manager force-close", () => {
    const decision = ncrMachine.canTransition(
      "verified",
      "closed",
      ncrCtx({ openEightDId: "8d-123", force: true, actorRole: "manager" }),
    );
    expect(decision.ok).toBe(true);
  });

  it("refuses a force-close from an inspector", () => {
    const decision = ncrMachine.canTransition(
      "verified",
      "closed",
      ncrCtx({ openEightDId: "8d-123", force: true, actorRole: "inspector" }),
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("FORBIDDEN");
  });

  it("closes normally when no 8D is attached", () => {
    const decision = ncrMachine.canTransition("verified", "closed", ncrCtx({ openEightDId: null }));
    expect(decision.ok).toBe(true);
  });
});

describe("Inspection state machine", () => {
  const ctx = { requiredItemIds: ["i1", "i2"], answeredItemIds: ["i1", "i2"] };

  const legal: Record<string, readonly InspectionStatus[]> = {
    scheduled: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  const pairs = InspectionStatus.values.flatMap((from) =>
    InspectionStatus.values.map((to) => [from, to] as const),
  );

  it.each(pairs)("%s → %s matches the specified graph", (from, to) => {
    const expected = from !== to && (legal[from] ?? []).includes(to);
    expect(inspectionMachine.canTransition(from, to, ctx).ok).toBe(expected);
  });

  it("blocks completion when a required item is unanswered", () => {
    const decision = inspectionMachine.canTransition("in_progress", "completed", {
      requiredItemIds: ["i1", "i2", "i3"],
      answeredItemIds: ["i1"],
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("VALIDATION_FAILED");
      expect(decision.details?.["missingItemIds"]).toEqual(["i2", "i3"]);
    }
  });

  it("ignores extra answers for items that are not required", () => {
    const decision = inspectionMachine.canTransition("in_progress", "completed", {
      requiredItemIds: ["i1"],
      answeredItemIds: ["i1", "i9", "i42"],
    });
    expect(decision.ok).toBe(true);
  });

  it("completes when nothing is required", () => {
    const decision = inspectionMachine.canTransition("in_progress", "completed", {
      requiredItemIds: [],
      answeredItemIds: [],
    });
    expect(decision.ok).toBe(true);
  });

  it("treats completed and cancelled as terminal", () => {
    expect(inspectionMachine.isTerminal("completed")).toBe(true);
    expect(inspectionMachine.isTerminal("cancelled")).toBe(true);
    expect(inspectionMachine.isTerminal("scheduled")).toBe(false);
  });
});

describe("CAPA phases advance forward only (02 §4)", () => {
  const pairs = CAPA_PHASE_ORDER.flatMap((from) =>
    CAPA_PHASE_ORDER.map((to) => [from, to] as const),
  );

  it.each(pairs)("%s → %s is legal only as a single step forward", (from, to) => {
    const fromIndex = CAPA_PHASE_ORDER.indexOf(from);
    const toIndex = CAPA_PHASE_ORDER.indexOf(to);
    const expected = toIndex === fromIndex + 1;
    expect(capaMachine.canTransition(from, to, {}).ok).toBe(expected);
  });

  it("cannot skip a phase", () => {
    expect(capaMachine.canTransition("initiation", "verification", {}).ok).toBe(false);
  });

  it("treats closed as terminal", () => {
    expect(capaMachine.isTerminal("closed")).toBe(true);
  });
});

describe("CAPA revert is an explicit, reasoned exception", () => {
  it("allows moving back with a reason", () => {
    expect(canRevertCapa("verification", "action_plan", { reason: "New evidence found" }).ok).toBe(
      true,
    );
  });

  it("requires a non-empty reason", () => {
    const decision = canRevertCapa("verification", "action_plan", { reason: "   " });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("VALIDATION_FAILED");
  });

  it("refuses to move forward — that is what the advance action is for", () => {
    expect(canRevertCapa("root_cause", "verification", { reason: "x" }).ok).toBe(false);
  });

  it("refuses to revert to the same phase", () => {
    expect(canRevertCapa("root_cause", "root_cause", { reason: "x" }).ok).toBe(false);
  });

  it("refuses to revert a closed CAPA", () => {
    expect(canRevertCapa("closed", "verification", { reason: "x" }).ok).toBe(false);
  });
});

describe("Document state machine", () => {
  const ctx = {
    actorId: "approver",
    actorRole: "manager" as const,
    ownerId: "author",
    otherApprovedVersionCount: 1,
  };

  const legal: Record<string, readonly DocumentStatus[]> = {
    draft: ["pending"],
    pending: ["approved", "rejected"],
    rejected: ["draft"],
    approved: ["archived"],
    archived: [],
  };

  const pairs = DocumentStatus.values.flatMap((from) =>
    DocumentStatus.values.map((to) => [from, to] as const),
  );

  it.each(pairs)("%s → %s matches the specified graph", (from, to) => {
    const expected = from !== to && (legal[from] ?? []).includes(to);
    expect(documentMachine.canTransition(from, to, ctx).ok).toBe(expected);
  });

  it("refuses approval from a role without the capability", () => {
    const decision = documentMachine.canTransition("pending", "approved", {
      ...ctx,
      actorRole: "inspector",
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("FORBIDDEN");
  });

  it("refuses self-approval by the author", () => {
    const decision = documentMachine.canTransition("pending", "approved", {
      ...ctx,
      actorId: "author",
      ownerId: "author",
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.details?.["requires"]).toBe("four_eyes");
  });

  it("refuses to archive the only approved version of a controlled document", () => {
    const decision = documentMachine.canTransition("approved", "archived", {
      ...ctx,
      otherApprovedVersionCount: 0,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("CONFLICT");
  });

  it("archives once a superseding approved version exists", () => {
    const decision = documentMachine.canTransition("approved", "archived", {
      ...ctx,
      otherApprovedVersionCount: 1,
    });
    expect(decision.ok).toBe(true);
  });
});
