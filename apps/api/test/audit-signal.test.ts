import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withAudit, type AuditEventInput, type Tx } from "@kaenal/db";
import type { AuditAction } from "@kaenal/types";
import {
  auditActionToRealtime,
  installAuditRealtimeBridge,
  signalForAuditEvent,
  uninstallAuditRealtimeBridge,
} from "../src/realtime/audit-signal.js";
import { runWithContext, type RequestContext } from "../src/context.js";
import type { RealtimeSignal } from "../src/realtime/realtime.service.js";

/**
 * The audit→realtime bridge mapping (Phase R2). Pure and exhaustive: this is the
 * single choke point that turns every audited mutation into a cache-invalidation
 * signal, so its topic/capability/action mapping must be exactly right — a wrong
 * capability would over- or under-notify a role; a missing kind would silently
 * drop live updates for a whole module.
 */

function event(entityKind: string, action: AuditAction): AuditEventInput {
  return { actorId: "u1", actorKind: "user", entityKind, entityId: "e1", action };
}

describe("auditActionToRealtime", () => {
  it("maps created → created", () => {
    expect(auditActionToRealtime("created")).toBe("created");
  });
  it("maps deleted and purged → deleted", () => {
    expect(auditActionToRealtime("deleted")).toBe("deleted");
    expect(auditActionToRealtime("purged")).toBe("deleted");
  });
  it("maps every other verb → updated", () => {
    for (const a of ["updated", "status_changed", "assigned", "restored", "linked", "file_attached", "signed"] as const) {
      expect(auditActionToRealtime(a)).toBe("updated");
    }
  });
});

describe("signalForAuditEvent", () => {
  it("maps ncr → ncr topic gated by ncr:view", () => {
    const s = signalForAuditEvent(event("ncr", "status_changed"), "t1");
    expect(s).not.toBeNull();
    expect(s?.tenantId).toBe("t1");
    expect(s?.capability).toBe("ncr:view");
    expect(s?.event.topic).toBe("ncr");
    expect(s?.event.action).toBe("updated");
    expect(s?.event.entityId).toBe("e1");
    // Signal is tenant-broadcast (no user targeting) but capability-filtered.
    expect(s?.userId).toBeUndefined();
  });

  it("routes 8D through NCR view rights (no dedicated eightd capability)", () => {
    const s = signalForAuditEvent(event("eight_d", "created"), "t1");
    expect(s?.event.topic).toBe("eightd");
    expect(s?.capability).toBe("ncr:view");
    expect(s?.event.action).toBe("created");
  });

  it("routes findings through inspection view rights", () => {
    const s = signalForAuditEvent(event("finding", "updated"), "t1");
    expect(s?.event.topic).toBe("inspection");
    expect(s?.capability).toBe("inspection:view");
  });

  it("maps sub-entities to their parent topic (ncr_action→ncr, fmea_item→fmea)", () => {
    expect(signalForAuditEvent(event("ncr_action", "created"), "t1")?.event.topic).toBe("ncr");
    expect(signalForAuditEvent(event("capa_action", "updated"), "t1")?.event.topic).toBe("capa");
    expect(signalForAuditEvent(event("fmea_item", "updated"), "t1")?.event.topic).toBe("fmea");
    expect(signalForAuditEvent(event("fmea_item", "updated"), "t1")?.capability).toBe("fmea:view");
  });

  it("maps each top-level QMS entity to its topic + view capability", () => {
    const cases: Array<[string, string, string]> = [
      ["capa", "capa", "capa:view"],
      ["inspection", "inspection", "inspection:view"],
      ["supplier", "supplier", "supplier:view"],
      ["ppap_submission", "ppap", "ppap:view"],
      ["scar", "scar", "scar:view"],
      ["document", "document", "document:view"],
      ["fmea", "fmea", "fmea:view"],
      ["audit", "audit", "audit:view"],
    ];
    for (const [kind, topic, cap] of cases) {
      const s = signalForAuditEvent(event(kind, "updated"), "t1");
      expect(s?.event.topic, kind).toBe(topic);
      expect(s?.capability, kind).toBe(cap);
    }
  });

  it("returns null for non-QMS-list entity kinds (no phantom signals)", () => {
    for (const kind of ["session", "membership", "invitation", "file", "export", "plant", "area", "integration"]) {
      expect(signalForAuditEvent(event(kind, "updated"), "t1"), kind).toBeNull();
    }
  });
});

/**
 * The choke point wired end to end — the REAL `withAudit` + the REAL installed
 * observer + the REAL request-context buffer — minus Redis/HTTP. Proves that
 * every audited mutation buffers a signal, that non-QMS kinds buffer nothing,
 * and that a mutation outside a request context (a seed script) is a safe no-op.
 * After-commit publication and no-emit-on-rollback are properties of the
 * lifecycle interceptor's flush and are verified live in the browser.
 */
describe("audit → realtime bridge (choke point)", () => {
  beforeAll(() => installAuditRealtimeBridge());
  afterAll(() => uninstallAuditRealtimeBridge());

  const fakeTx = (): Tx => ({ query: async () => ({ rows: [], rowCount: 0 }) }) as unknown as Tx;

  const ctxWith = (signals: RealtimeSignal[]): RequestContext => ({
    requestId: "r",
    tenantId: "t1",
    tenantSlug: "acme",
    userId: "u1",
    membership: { role: "admin", plantIds: [] },
    tx: fakeTx(),
    pool: undefined,
    ip: null,
    userAgent: null,
    signals,
  });

  const auditInput = (entityKind: string): AuditEventInput => ({
    actorId: "u1",
    actorKind: "user",
    entityKind,
    entityId: "e1",
    action: "created",
  });

  it("buffers a signal into the request context for an audited QMS mutation", async () => {
    const signals: RealtimeSignal[] = [];
    await runWithContext(ctxWith(signals), () =>
      withAudit(fakeTx(), "t1", auditInput("ncr"), async () => "ok"),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]?.event.topic).toBe("ncr");
    expect(signals[0]?.capability).toBe("ncr:view");
  });

  it("buffers nothing for a non-QMS entity kind", async () => {
    const signals: RealtimeSignal[] = [];
    await runWithContext(ctxWith(signals), () =>
      withAudit(fakeTx(), "t1", auditInput("session"), async () => "ok"),
    );
    expect(signals).toHaveLength(0);
  });

  it("is a safe no-op when mutating outside a request context (seed scripts)", async () => {
    await expect(
      withAudit(fakeTx(), "t1", auditInput("ncr"), async () => "ok"),
    ).resolves.toBe("ok");
  });
});
