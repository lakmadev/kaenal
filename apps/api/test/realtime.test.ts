import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";
import type { Membership } from "@kaenal/core";
import type { RealtimeEvent } from "@kaenal/types";
import {
  RealtimeService,
  RT_CHANNEL,
  type RealtimeSignal,
  type StreamIdentity,
} from "../src/realtime/realtime.service.js";

/**
 * The realtime signal bus (Phase R1). These are pure fan-out tests — no DB, no
 * HTTP — because the security that matters here is *who a signal reaches*:
 *   - never another tenant,
 *   - user targeting is honoured,
 *   - the capability gate is honoured (a role that can't view a module never
 *     even learns its data changed).
 * If any of these regress, tenant A could be told tenant B's data changed.
 */

function membership(role: Membership["role"]): Membership {
  return { role, plantIds: [] };
}

function identity(tenantId: string, userId: string, role: Membership["role"]): StreamIdentity {
  return { tenantId, userId, membership: membership(role) };
}

const event = (topic: RealtimeEvent["topic"]): RealtimeEvent => ({
  topic,
  action: "created",
  at: new Date().toISOString(),
});

/** One stub used as both the pub and the (dedicated) sub connection. It records
 *  publishes and captures the `message` handler so a test can push a Redis
 *  message through the REAL fan-out path. */
function stubRedis(): {
  redis: Redis;
  deliver: (signal: RealtimeSignal) => void;
  deliverRaw: (payload: string) => void;
  published: string[];
} {
  let onMessage: ((channel: string, payload: string) => void) | undefined;
  const published: string[] = [];
  const redis = {
    subscribe: vi.fn(async () => 1),
    on(evt: string, cb: (channel: string, payload: string) => void) {
      if (evt === "message") onMessage = cb;
      return redis;
    },
    publish: vi.fn(async (_channel: string, payload: string) => {
      published.push(payload);
      return 1;
    }),
    quit: vi.fn(async () => "OK"),
  };
  return {
    redis: redis as unknown as Redis,
    deliver: (signal) => onMessage?.(RT_CHANNEL, JSON.stringify(signal)),
    deliverRaw: (payload) => onMessage?.(RT_CHANNEL, payload),
    published,
  };
}

describe("RealtimeService.matches (isolation core)", () => {
  const admin = identity("t1", "u1", "admin");

  it("delivers an untargeted signal within the same tenant", () => {
    expect(RealtimeService.matches({ tenantId: "t1", event: event("ncr") }, admin)).toBe(true);
  });

  it("never crosses tenants", () => {
    expect(RealtimeService.matches({ tenantId: "t2", event: event("ncr") }, admin)).toBe(false);
  });

  it("honours user targeting", () => {
    const sig: RealtimeSignal = { tenantId: "t1", userId: "u1", event: event("notifications") };
    expect(RealtimeService.matches(sig, admin)).toBe(true);
    expect(RealtimeService.matches({ ...sig, userId: "u2" }, admin)).toBe(false);
  });

  it("treats null/undefined userId as broadcast to the tenant", () => {
    expect(RealtimeService.matches({ tenantId: "t1", userId: null, event: event("ncr") }, admin)).toBe(true);
  });

  it("honours the capability gate", () => {
    const gated: RealtimeSignal = { tenantId: "t1", capability: "settings:manage", event: event("audit") };
    // admin holds every capability; a viewer does not hold settings:manage.
    expect(RealtimeService.matches(gated, identity("t1", "u1", "admin"))).toBe(true);
    expect(RealtimeService.matches(gated, identity("t1", "u9", "viewer"))).toBe(false);
  });
});

describe("RealtimeService fan-out", () => {
  it("routes a Redis message only to streams it targets", () => {
    const stub = stubRedis();
    const svc = new RealtimeService(stub.redis, stub.redis);

    const a: RealtimeEvent[] = [];
    const b: RealtimeEvent[] = [];
    svc.addClient(identity("t1", "u1", "admin"), (e) => a.push(e));
    svc.addClient(identity("t2", "u2", "admin"), (e) => b.push(e));
    expect(svc.connectionCount).toBe(2);

    stub.deliver({ tenantId: "t1", event: event("ncr") });

    expect(a).toHaveLength(1);
    expect(a[0]?.topic).toBe("ncr");
    expect(b).toHaveLength(0); // other tenant never sees it
  });

  it("delivers a user-targeted signal to only that user's stream", () => {
    const stub = stubRedis();
    const svc = new RealtimeService(stub.redis, stub.redis);
    const u1: RealtimeEvent[] = [];
    const u2: RealtimeEvent[] = [];
    svc.addClient(identity("t1", "u1", "admin"), (e) => u1.push(e));
    svc.addClient(identity("t1", "u2", "admin"), (e) => u2.push(e));

    stub.deliver({ tenantId: "t1", userId: "u1", event: event("notifications") });

    expect(u1).toHaveLength(1);
    expect(u2).toHaveLength(0);
  });

  it("withholds a capability-gated signal from a role that lacks it", () => {
    const stub = stubRedis();
    const svc = new RealtimeService(stub.redis, stub.redis);
    const adminSeen: RealtimeEvent[] = [];
    const viewerSeen: RealtimeEvent[] = [];
    svc.addClient(identity("t1", "ua", "admin"), (e) => adminSeen.push(e));
    svc.addClient(identity("t1", "uv", "viewer"), (e) => viewerSeen.push(e));

    stub.deliver({ tenantId: "t1", capability: "settings:manage", event: event("audit") });

    expect(adminSeen).toHaveLength(1);
    expect(viewerSeen).toHaveLength(0);
  });

  it("stops delivering after unsubscribe", () => {
    const stub = stubRedis();
    const svc = new RealtimeService(stub.redis, stub.redis);
    const seen: RealtimeEvent[] = [];
    const off = svc.addClient(identity("t1", "u1", "admin"), (e) => seen.push(e));

    stub.deliver({ tenantId: "t1", event: event("ncr") });
    off();
    expect(svc.connectionCount).toBe(0);
    stub.deliver({ tenantId: "t1", event: event("ncr") });

    expect(seen).toHaveLength(1); // only the pre-unsubscribe one
  });

  it("ignores a malformed Redis payload without throwing", () => {
    const stub = stubRedis();
    const svc = new RealtimeService(stub.redis, stub.redis);
    const seen: RealtimeEvent[] = [];
    svc.addClient(identity("t1", "u1", "admin"), (e) => seen.push(e));

    expect(() => stub.deliverRaw("not-json{")).not.toThrow();
    expect(seen).toHaveLength(0);
  });

  it("emit() publishes the signal as JSON on the bus channel", async () => {
    const stub = stubRedis();
    const svc = new RealtimeService(stub.redis, stub.redis);

    svc.emit({ tenantId: "t1", userId: "u1", event: event("notifications") });
    // emit is fire-and-forget; let the microtask settle.
    await Promise.resolve();

    expect(stub.published).toHaveLength(1);
    const parsed = JSON.parse(stub.published[0] ?? "{}") as RealtimeSignal;
    expect(parsed.tenantId).toBe("t1");
    expect(parsed.event.topic).toBe("notifications");
  });
});
