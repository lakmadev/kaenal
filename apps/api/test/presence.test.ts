import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { PresenceService } from "../src/realtime/presence.service.js";
import type { RealtimeService, RealtimeSignal } from "../src/realtime/realtime.service.js";

/**
 * Live presence (Phase R4) against a real Redis. Pins: a heartbeat makes you a
 * viewer, `editing` is reflected, leaving removes you, an expired detail key is
 * pruned from the index on the next read (a crashed client drops out), tenants
 * never see each other's presence, and every snapshot is pushed to each CURRENT
 * viewer (the audience is exactly the presence set).
 */

let redis: Redis;
const emitted: RealtimeSignal[] = [];
const realtime = { emit: (s: RealtimeSignal) => emitted.push(s) } as unknown as RealtimeService;
let presence: PresenceService;

const T1 = `t1-${randomUUID().slice(0, 8)}`;
const T2 = `t2-${randomUUID().slice(0, 8)}`;
const NCR = "ncr-1";

beforeAll(() => {
  redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6380");
  presence = new PresenceService(redis, realtime);
});

afterAll(async () => {
  // Clean our keys and close.
  const keys = await redis.keys("pz:*");
  if (keys.length > 0) await redis.del(...keys);
  await redis.quit();
});

describe("PresenceService", () => {
  it("a heartbeat makes you a viewer; editing is reflected", async () => {
    const snap = await presence.heartbeat(T1, "ncr", NCR, "userA", false);
    expect(snap.viewers).toEqual([{ userId: "userA", editing: false }]);

    const editing = await presence.heartbeat(T1, "ncr", NCR, "userA", true);
    expect(editing.viewers).toEqual([{ userId: "userA", editing: true }]);
  });

  it("multiple viewers appear; leaving removes only that viewer", async () => {
    await presence.heartbeat(T1, "ncr", NCR, "userA", false);
    const two = await presence.heartbeat(T1, "ncr", NCR, "userB", false);
    expect(two.viewers.map((v) => v.userId)).toEqual(["userA", "userB"]);

    const afterLeave = await presence.leave(T1, "ncr", NCR, "userA");
    expect(afterLeave.viewers.map((v) => v.userId)).toEqual(["userB"]);
  });

  it("broadcasts the snapshot to each current viewer, user-targeted", async () => {
    emitted.length = 0;
    await presence.heartbeat(T1, "ncr", NCR, "userA", false); // viewers: A, B
    // One emit per current viewer (A and B), all topic 'presence', tenant-scoped.
    const targets = emitted.map((e) => e.userId).sort();
    expect(targets).toEqual(["userA", "userB"]);
    for (const e of emitted) {
      expect(e.tenantId).toBe(T1);
      expect(e.event.topic).toBe("presence");
      expect(e.event.entityType).toBe("ncr");
      expect(e.event.entityId).toBe(NCR);
      expect(e.event.viewers?.map((v) => v.userId).sort()).toEqual(["userA", "userB"]);
    }
  });

  it("prunes a viewer whose detail key expired (crashed client)", async () => {
    await presence.heartbeat(T1, "ncr", NCR, "ghost", false);
    // Simulate the TTL lapsing: drop the detail key but leave the index entry.
    await redis.del(`pz:v:${T1}:ncr:${NCR}:ghost`);
    const snap = await presence.snapshot(T1, "ncr", NCR);
    expect(snap.viewers.map((v) => v.userId)).not.toContain("ghost");
    // And the stale index member is gone.
    expect(await redis.sismember(`pz:idx:${T1}:ncr:${NCR}`, "ghost")).toBe(0);
  });

  it("never leaks presence across tenants", async () => {
    await presence.heartbeat(T1, "ncr", NCR, "userA", false);
    await presence.heartbeat(T2, "ncr", NCR, "spy", false);
    const t1 = await presence.snapshot(T1, "ncr", NCR);
    const t2 = await presence.snapshot(T2, "ncr", NCR);
    expect(t1.viewers.some((v) => v.userId === "spy")).toBe(false);
    expect(t2.viewers.map((v) => v.userId)).toEqual(["spy"]);
  });

  it("an empty entity yields an empty snapshot", async () => {
    const snap = await presence.snapshot(T1, "inspection", "never-touched");
    expect(snap).toEqual({ entityType: "inspection", entityId: "never-touched", viewers: [] });
  });
});
