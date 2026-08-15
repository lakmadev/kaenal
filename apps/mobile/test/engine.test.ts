import { describe, expect, it } from "vitest";

import { createMemorySyncStore } from "../src/services/db/memory-store.js";
import { SyncEngine } from "../src/sync/engine.js";
import type { SyncReadSource } from "../src/sync/read-source.js";
import type { PushFn } from "../src/sync/pusher.js";
import type { MutationRecord, PushOutcome } from "../src/sync/types.js";

function base(over: Partial<MutationRecord> = {}): Omit<MutationRecord, "attempts" | "status" | "error" | "nextAttemptAt" | "createdAt"> {
  return {
    id: over.id ?? "m1",
    kind: over.kind ?? "ncr.create",
    entityType: over.entityType ?? "ncr",
    entityId: over.entityId ?? "e1",
    payload: over.payload ?? { title: "Scratch on housing" },
    baseUpdatedAt: over.baseUpdatedAt ?? null,
    baseVersion: over.baseVersion ?? null,
    dependsOnFileIds: over.dependsOnFileIds ?? [],
  };
}

const emptyReadSource: SyncReadSource = { pull: async (_e, since) => ({ rows: [], cursor: since }) };
let clock = Date.parse("2026-08-15T00:00:00.000Z");
const now = () => clock;

function engineWith(push: PushFn, opts: { online?: () => boolean; readSource?: SyncReadSource } = {}) {
  const store = createMemorySyncStore();
  const engine = new SyncEngine({
    store,
    readSource: opts.readSource ?? emptyReadSource,
    push,
    pullEntities: ["ncr"],
    isOnline: opts.online ?? (() => true),
    now,
  });
  return { store, engine };
}

describe("SyncEngine push path (05 §2.2/§2.3)", () => {
  it("pushes a queued create, marks it done, mirrors the server row, and drains the queue", async () => {
    const seen: string[] = [];
    const push: PushFn = async (m) => {
      seen.push(m.id);
      return { kind: "ok", serverUpdatedAt: "2026-08-15T01:00:00.000Z", serverVersion: 1 } satisfies PushOutcome;
    };
    const { store, engine } = engineWith(push);
    await store.init();
    await engine.enqueue(base({ id: "m1" }));
    // enqueue kicks sync(); await a settle cycle explicitly too.
    await engine.sync();

    expect(seen).toEqual(["m1"]);
    expect(await store.listMutations()).toHaveLength(0); // done items are dropped
    const mirrored = await store.getMirror("ncr", "e1");
    expect(mirrored?.version).toBe(1);
  });

  it("holds mutations while offline and flushes them when back online", async () => {
    let online = false;
    const pushed: string[] = [];
    const push: PushFn = async (m) => {
      pushed.push(m.id);
      return { kind: "ok", serverUpdatedAt: "t", serverVersion: 1 };
    };
    const { store, engine } = engineWith(push, { online: () => online });
    await store.init();
    await engine.enqueue(base({ id: "m1" }));
    await engine.sync();
    expect(pushed).toEqual([]); // nothing pushed offline
    expect((await store.listMutations())[0]?.status).toBe("pending");

    online = true;
    await engine.sync();
    expect(pushed).toEqual(["m1"]);
  });

  it("retries a transient failure with backoff, then succeeds", async () => {
    let attempt = 0;
    const push: PushFn = async () => (attempt++ === 0 ? { kind: "transient" } : { kind: "ok", serverUpdatedAt: "t", serverVersion: 1 });
    const { store, engine } = engineWith(push);
    await store.init();
    await engine.enqueue(base({ id: "m1" }));
    await engine.sync();

    // First attempt failed → back to pending with a future backoff gate.
    let q = await store.listMutations();
    expect(q[0]?.status).toBe("pending");
    expect(q[0]?.attempts).toBe(1);
    expect(Date.parse(q[0]!.nextAttemptAt!)).toBeGreaterThan(clock);

    // Advance past the gate → second attempt succeeds and drains.
    clock += 5000;
    await engine.sync();
    q = await store.listMutations();
    expect(q).toHaveLength(0);
  });

  it("surfaces a stale_write as needs_review, preserving local data", async () => {
    const push: PushFn = async () => ({ kind: "stale_write" });
    const { store, engine } = engineWith(push);
    await store.init();
    await engine.enqueue(base({ id: "m1", kind: "inspection.answer", entityType: "inspection" }));
    await engine.sync();

    const q = await store.listMutations();
    expect(q[0]?.status).toBe("failed");
    expect(q[0]?.error).toMatch(/^REVIEW:/);
    const summary = await engine.summary();
    expect(summary.needsReview).toBe(1);
    expect(summary.failed).toBe(0); // needs-review is counted separately from hard failures
  });

  it("hard-fails a validation error without retrying", async () => {
    let calls = 0;
    const push: PushFn = async () => {
      calls++;
      return { kind: "validation", message: "title required" };
    };
    const { store, engine } = engineWith(push);
    await store.init();
    await engine.enqueue(base({ id: "m1" }));
    await engine.sync();
    await engine.sync(); // a second cycle must NOT retry a failed item

    expect(calls).toBe(1);
    const q = await store.listMutations();
    expect(q[0]?.status).toBe("failed");
    expect(q[0]?.error).toBe("title required");
  });

  it("pauses the queue on auth failure and resumes after re-auth", async () => {
    let mode: "auth" | "ok" = "auth";
    const push: PushFn = async () => (mode === "auth" ? { kind: "auth" } : { kind: "ok", serverUpdatedAt: "t", serverVersion: 1 });
    const { store, engine } = engineWith(push);
    await store.init();
    await engine.enqueue(base({ id: "m1" }));
    await engine.sync();

    // Paused: item stays pending, not failed; data preserved.
    expect((await store.listMutations())[0]?.status).toBe("pending");

    mode = "ok";
    engine.resume();
    await engine.sync();
    expect(await store.listMutations()).toHaveLength(0);
  });

  it("pulls a delta batch into the mirror and advances the cursor", async () => {
    const readSource: SyncReadSource = {
      pull: async (entity, since) => {
        if (since) return { rows: [], cursor: since };
        return {
          rows: [{ entityType: entity, id: "n1", updatedAt: "2026-08-15T02:00:00.000Z", version: 2, deleted: false, data: { id: "n1" } }],
          cursor: "2026-08-15T02:00:00.000Z~n1",
        };
      },
    };
    const { store, engine } = engineWith(async () => ({ kind: "ok", serverUpdatedAt: "t", serverVersion: 1 }), { readSource });
    await store.init();
    await engine.sync();

    expect(await store.getMirror("ncr", "n1")).not.toBeNull();
    expect(await store.getCursor("ncr")).toBe("2026-08-15T02:00:00.000Z~n1");
  });
});
