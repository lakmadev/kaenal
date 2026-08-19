import { describe, expect, it } from "vitest";

import {
  discard,
  enqueue,
  entityKey,
  markDone,
  markFailed,
  markInflight,
  markRetry,
  queueCounts,
  runnableMutations,
} from "../src/sync/queue.js";
import type { MutationRecord, PendingFile } from "../src/sync/types.js";

function mut(over: Partial<MutationRecord> = {}): MutationRecord {
  return {
    id: over.id ?? "m1",
    kind: over.kind ?? "ncr.create",
    entityType: over.entityType ?? "ncr",
    entityId: over.entityId ?? "e1",
    payload: over.payload ?? {},
    baseUpdatedAt: over.baseUpdatedAt ?? null,
    baseVersion: over.baseVersion ?? null,
    dependsOnFileIds: over.dependsOnFileIds ?? [],
    attempts: over.attempts ?? 0,
    status: over.status ?? "pending",
    error: over.error ?? null,
    createdAt: over.createdAt ?? "2026-08-15T00:00:00.000Z",
    nextAttemptAt: over.nextAttemptAt ?? null,
  };
}

const NO_FILES = new Map<string, PendingFile>();
const T0 = Date.parse("2026-08-15T00:00:00.000Z");

describe("mutation queue reducer", () => {
  it("enqueues immutably", () => {
    const q0: MutationRecord[] = [];
    const q1 = enqueue(q0, mut());
    expect(q0).toHaveLength(0);
    expect(q1).toHaveLength(1);
  });

  it("runs only the FIFO head per entity, parallel across entities", () => {
    const q = [
      mut({ id: "a1", entityId: "A", createdAt: "2026-08-15T00:00:01.000Z" }),
      mut({ id: "a2", entityId: "A", createdAt: "2026-08-15T00:00:02.000Z" }),
      mut({ id: "b1", entityId: "B", createdAt: "2026-08-15T00:00:03.000Z" }),
    ];
    const runnable = runnableMutations(q, NO_FILES, T0 + 10_000).map((m) => m.id);
    expect(runnable).toEqual(["a1", "b1"]); // a2 blocked behind a1; B proceeds in parallel
  });

  it("a failed head blocks only its own entity's queue", () => {
    const q = [
      mut({ id: "a1", entityId: "A", status: "failed", createdAt: "2026-08-15T00:00:01.000Z" }),
      mut({ id: "a2", entityId: "A", createdAt: "2026-08-15T00:00:02.000Z" }),
      mut({ id: "b1", entityId: "B", createdAt: "2026-08-15T00:00:03.000Z" }),
    ];
    const runnable = runnableMutations(q, NO_FILES, T0 + 10_000).map((m) => m.id);
    expect(runnable).toEqual(["b1"]);
  });

  it("waits for a backoff gate", () => {
    const q = [mut({ id: "a1", nextAttemptAt: new Date(T0 + 60_000).toISOString() })];
    expect(runnableMutations(q, NO_FILES, T0)).toHaveLength(0);
    expect(runnableMutations(q, NO_FILES, T0 + 61_000)).toHaveLength(1);
  });

  it("blocks a mutation until its files have uploaded (dependency ordering)", () => {
    const q = [mut({ id: "a1", dependsOnFileIds: ["f1"] })];
    const pending: PendingFile = {
      id: "f1", localUri: "file://x", mime: "image/jpeg", bytes: 10, sha256: null,
      status: "pending", remoteId: null, error: null, createdAt: "2026-08-15T00:00:00.000Z",
    };
    expect(runnableMutations(q, new Map([["f1", pending]]), T0 + 10_000)).toHaveLength(0);
    const uploaded = { ...pending, status: "uploaded" as const, remoteId: "srv-1" };
    expect(runnableMutations(q, new Map([["f1", uploaded]]), T0 + 10_000)).toHaveLength(1);
  });

  it("markRetry increments attempts and sets an exponential backoff gate", () => {
    let q = [mut({ id: "a1" })];
    q = markRetry(q, "a1", T0);
    expect(q[0]!.attempts).toBe(1);
    expect(Date.parse(q[0]!.nextAttemptAt!)).toBe(T0 + 2000); // 2^1 s
    q = markRetry(q, "a1", T0);
    expect(q[0]!.attempts).toBe(2);
    expect(Date.parse(q[0]!.nextAttemptAt!)).toBe(T0 + 4000); // 2^2 s
  });

  it("status transitions and counts", () => {
    let q = [mut({ id: "a1" }), mut({ id: "b1", entityId: "B" })];
    q = markInflight(q, "a1");
    expect(queueCounts(q)).toEqual({ pending: 1, inflight: 1, failed: 0 });
    q = markDone(q, "a1");
    q = markFailed(q, "b1", "boom");
    expect(queueCounts(q)).toEqual({ pending: 0, inflight: 0, failed: 1 });
    expect(q.find((m) => m.id === "b1")!.error).toBe("boom");
  });

  it("discard drops an item (the only path that removes)", () => {
    const q = [mut({ id: "a1" }), mut({ id: "b1" })];
    expect(discard(q, "a1").map((m) => m.id)).toEqual(["b1"]);
  });

  it("entityKey namespaces by type and id", () => {
    expect(entityKey({ entityType: "ncr", entityId: "x" })).toBe("ncr:x");
  });
});
