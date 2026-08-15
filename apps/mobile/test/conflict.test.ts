import { describe, expect, it } from "vitest";

import { computeBackoffMs, fieldClassOf, resolveConflict } from "../src/sync/conflict.js";
import type { MutationRecord, PushOutcome } from "../src/sync/types.js";

function mut(kind: string): MutationRecord {
  return {
    id: "m", kind, entityType: kind.split(".")[0]!, entityId: "e", payload: {},
    baseUpdatedAt: "2026-08-15T00:00:00.000Z", baseVersion: 1, dependsOnFileIds: [],
    attempts: 0, status: "inflight", error: null, createdAt: "2026-08-15T00:00:00.000Z", nextAttemptAt: null,
  };
}

describe("field class derivation (05 §2.3)", () => {
  it("maps verbs to classes", () => {
    expect(fieldClassOf("ncr.create")).toBe("create");
    expect(fieldClassOf("inspection.answer")).toBe("inspection_response");
    expect(fieldClassOf("ncr.transition")).toBe("status_transition");
    expect(fieldClassOf("inspection.complete")).toBe("status_transition");
    expect(fieldClassOf("note.edit")).toBe("free_text");
  });
});

describe("backoff schedule", () => {
  it("is exponential and capped at 5 minutes", () => {
    expect(computeBackoffMs(0)).toBe(1000);
    expect(computeBackoffMs(1)).toBe(2000);
    expect(computeBackoffMs(8)).toBe(256_000);
    expect(computeBackoffMs(20)).toBe(300_000); // capped
  });
});

describe("conflict resolution (05 §2.3)", () => {
  it("ok → done, carrying the server row forward", () => {
    const out: PushOutcome = { kind: "ok", serverUpdatedAt: "2026-08-15T01:00:00.000Z", serverVersion: 5 };
    expect(resolveConflict(mut("ncr.create"), out)).toEqual({
      action: "done", serverUpdatedAt: "2026-08-15T01:00:00.000Z", serverVersion: 5,
    });
  });

  it("transient → retry (safe to replay)", () => {
    expect(resolveConflict(mut("ncr.create"), { kind: "transient" })).toEqual({ action: "retry" });
  });

  it("auth → pause (keep data, never wipe)", () => {
    expect(resolveConflict(mut("ncr.create"), { kind: "auth" }).action).toBe("pause");
  });

  it("stale_write on an inspection response → needs_review with a floor-specific message", () => {
    const d = resolveConflict(mut("inspection.answer"), { kind: "stale_write" });
    expect(d.action).toBe("needs_review");
    if (d.action === "needs_review") expect(d.reason).toMatch(/inspection changed/i);
  });

  it("stale_write on a status transition → needs_review", () => {
    const d = resolveConflict(mut("ncr.transition"), { kind: "stale_write" });
    expect(d.action).toBe("needs_review");
    if (d.action === "needs_review") expect(d.reason).toMatch(/status changed/i);
  });

  it("illegal transition → needs_review with the server message", () => {
    const d = resolveConflict(mut("ncr.transition"), { kind: "conflict_transition", message: "Closed by Anna." });
    expect(d).toEqual({ action: "needs_review", reason: "Closed by Anna." });
  });

  it("not_found → needs_review (removed / cross-tenant)", () => {
    expect(resolveConflict(mut("ncr.transition"), { kind: "not_found" }).action).toBe("needs_review");
  });

  it("validation → failed (blind retry would fail identically)", () => {
    const d = resolveConflict(mut("ncr.create"), { kind: "validation", message: "bad payload" });
    expect(d).toEqual({ action: "failed", reason: "bad payload" });
  });
});
