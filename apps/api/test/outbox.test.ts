import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withAudit, withTenant, type AuditEventInput } from "@kaenal/db";
import type { AuditAction } from "@kaenal/types";
import { auditActionToOutbox, outboxEventFor } from "../src/outbox/outbox-event.js";
import { installOutboxBridge, uninstallOutboxBridge } from "../src/outbox/outbox-bridge.js";
import {
  OUTBOX_MAX_ATTEMPTS,
  drainOutboxForTenant,
  outboxBackoffSeconds,
} from "../src/jobs/processors/drain-outbox.js";
import type { OutboxEvent, OutboxHandler } from "../src/outbox/outbox.types.js";

/**
 * Transactional outbox (0041, Sequence 2). Pins the two halves and their
 * contract:
 *  - the WRITE half is transactional — an outbox row is written in the SAME tx
 *    as the mutation + its audit event, so a rollback erases it and an unmapped
 *    entity kind writes nothing;
 *  - the DRAIN half is at-least-once and RLS-scoped — pending rows are delivered
 *    and marked, a failing handler reschedules with backoff and finally
 *    dead-letters, and a drain for one tenant never sees another's events.
 */

const ACME = "acme";
const GLOBEX = "globex";

let control: pg.Pool;
let acmeId = "";
let globexId = "";

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

/** Insert a pending outbox row directly, as a specific tenant (RLS-scoped). */
async function seedOutboxRow(
  tenantId: string,
  overrides: { attempts?: number; entityId?: string } = {},
): Promise<string> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO outbox
         (tenant_id, event_type, entity_kind, entity_id, action, actor_kind, payload, attempts)
       VALUES ($1, 'ncr.created', 'ncr', $2::uuid, 'created', 'system',
               jsonb_build_object('entityId', $2, 'at', now()), $3)
       RETURNING id`,
      [tenantId, overrides.entityId ?? randomUUID(), overrides.attempts ?? 0],
    );
    return rows[0]?.id ?? "";
  });
}

interface OutboxRowState {
  status: string;
  attempts: number;
  last_error: string | null;
  published_at: Date | null;
  available_at: Date;
}

async function readRow(tenantId: string, id: string): Promise<OutboxRowState | undefined> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<OutboxRowState>(
      `SELECT status, attempts, last_error, published_at, available_at FROM outbox WHERE id = $1`,
      [id],
    );
    return rows[0];
  });
}

async function countOutbox(tenantId: string, entityId: string): Promise<number> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM outbox WHERE entity_id = $1`,
      [entityId],
    );
    return Number(rows[0]?.n ?? "0");
  });
}

async function countAudit(tenantId: string, entityId: string): Promise<number> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events WHERE entity_id = $1`,
      [entityId],
    );
    return Number(rows[0]?.n ?? "0");
  });
}

class RecordingHandler implements OutboxHandler {
  readonly delivered: OutboxEvent[] = [];
  deliver(event: OutboxEvent): Promise<void> {
    this.delivered.push(event);
    return Promise.resolve();
  }
}

class ThrowingHandler implements OutboxHandler {
  deliver(): Promise<void> {
    return Promise.reject(new Error("delivery failed: 503 upstream"));
  }
}

const auditFor = (entityKind: string, entityId: string, action: AuditAction = "created"): AuditEventInput => ({
  actorId: null,
  actorKind: "system",
  entityKind,
  entityId,
  action,
});

// ─── Pure mapping (no DB) ───────────────────────────────────────────────────

describe("auditActionToOutbox", () => {
  it("maps created → created", () => {
    expect(auditActionToOutbox("created")).toBe("created");
  });
  it("maps deleted and purged → deleted", () => {
    expect(auditActionToOutbox("deleted")).toBe("deleted");
    expect(auditActionToOutbox("purged")).toBe("deleted");
  });
  it("maps every other verb → updated", () => {
    for (const a of ["updated", "status_changed", "assigned", "restored", "linked", "file_attached"] as const) {
      expect(auditActionToOutbox(a)).toBe("updated");
    }
  });
});

describe("outboxEventFor", () => {
  it("builds a namespaced event for a deliverable QMS entity", () => {
    const rec = outboxEventFor(auditFor("ncr", "e1", "status_changed"), "t1");
    expect(rec).not.toBeNull();
    expect(rec?.eventType).toBe("ncr.updated");
    expect(rec?.tenantId).toBe("t1");
    expect(rec?.entityKind).toBe("ncr");
    expect(rec?.entityId).toBe("e1");
    expect(rec?.action).toBe("updated");
    // Envelope carries identity only — never row data.
    expect(rec?.payload.entityId).toBe("e1");
    expect(typeof rec?.payload.at).toBe("string");
  });

  it("passes the actor through (created → created event name)", () => {
    const rec = outboxEventFor(
      { actorId: "u9", actorKind: "user", entityKind: "capa", entityId: "c1", action: "created" },
      "t1",
    );
    expect(rec?.eventType).toBe("capa.created");
    expect(rec?.actorId).toBe("u9");
    expect(rec?.actorKind).toBe("user");
  });

  it("returns null for non-deliverable kinds (no outbox churn)", () => {
    for (const kind of ["session", "membership", "invitation", "file", "export", "settings", "integration"]) {
      expect(outboxEventFor(auditFor(kind, "e1"), "t1"), kind).toBeNull();
    }
  });
});

describe("outboxBackoffSeconds", () => {
  it("is exponential and capped at one hour", () => {
    expect(outboxBackoffSeconds(1)).toBe(2);
    expect(outboxBackoffSeconds(3)).toBe(8);
    expect(outboxBackoffSeconds(6)).toBe(64);
    expect(outboxBackoffSeconds(20)).toBe(3600); // capped
  });
});

// ─── Transactional write + drain (real DB) ──────────────────────────────────

describe("outbox — transactional write + drain", () => {
  beforeAll(async () => {
    control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
    acmeId = await tid(ACME);
    globexId = await tid(GLOBEX);
    installOutboxBridge();
  });

  afterAll(async () => {
    uninstallOutboxBridge();
    await control.query("DELETE FROM outbox WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
    // audit_events is append-only (a trigger blocks DELETE even for the owner);
    // the handful of system-actor rows this suite writes are harmless to leave.
    await control.end();
  });

  afterEach(async () => {
    await control.query("DELETE FROM outbox WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  });

  it("writes an outbox row in the SAME tx as an audited mutation", async () => {
    const entityId = randomUUID();
    await withTenant(acmeId, null, (tx) => withAudit(tx, acmeId, auditFor("ncr", entityId), async () => "done"));

    expect(await countOutbox(acmeId, entityId)).toBe(1);
    const row = await withTenant(acmeId, null, async (tx) => {
      const { rows } = await tx.query<{ event_type: string; status: string }>(
        `SELECT event_type, status FROM outbox WHERE entity_id = $1`,
        [entityId],
      );
      return rows[0];
    });
    expect(row?.event_type).toBe("ncr.created");
    expect(row?.status).toBe("pending");
  });

  it("rolls the outbox row back when the mutation's tx rolls back (atomicity)", async () => {
    const entityId = randomUUID();
    await expect(
      withTenant(acmeId, null, async (tx) => {
        await withAudit(tx, acmeId, auditFor("ncr", entityId), async () => "done");
        // The audit event AND the outbox row are now written on this tx; force a
        // rollback and prove BOTH vanish — the outbox can never diverge from the
        // change (or its audit trail) that produced it.
        throw new Error("boom after audit + outbox written");
      }),
    ).rejects.toThrow("boom");

    expect(await countOutbox(acmeId, entityId)).toBe(0);
    expect(await countAudit(acmeId, entityId)).toBe(0);
  });

  it("writes NO outbox row for a non-deliverable entity kind (but still audits)", async () => {
    const entityId = randomUUID();
    await withTenant(acmeId, null, (tx) => withAudit(tx, acmeId, auditFor("session", entityId), async () => "done"));

    expect(await countOutbox(acmeId, entityId)).toBe(0);
    expect(await countAudit(acmeId, entityId)).toBe(1);
  });

  it("drains pending events, delivers them, and marks them delivered (idempotent)", async () => {
    const ids = [await seedOutboxRow(acmeId), await seedOutboxRow(acmeId), await seedOutboxRow(acmeId)];
    const handler = new RecordingHandler();

    const res = await drainOutboxForTenant(acmeId, { handler });
    expect(res).toMatchObject({ claimed: 3, delivered: 3, rescheduled: 0, deadLettered: 0 });
    expect(handler.delivered).toHaveLength(3);

    for (const id of ids) {
      const row = await readRow(acmeId, id);
      expect(row?.status).toBe("delivered");
      expect(row?.published_at).not.toBeNull();
    }

    // Re-drain: nothing left pending → a no-op, nothing re-delivered.
    const again = await drainOutboxForTenant(acmeId, { handler });
    expect(again.claimed).toBe(0);
    expect(handler.delivered).toHaveLength(3);
  });

  it("reschedules a failed delivery with backoff and records the error", async () => {
    const id = await seedOutboxRow(acmeId);
    const res = await drainOutboxForTenant(acmeId, { handler: new ThrowingHandler() });
    expect(res).toMatchObject({ claimed: 1, delivered: 0, rescheduled: 1, deadLettered: 0 });

    const row = await readRow(acmeId, id);
    expect(row?.status).toBe("pending");
    expect(row?.attempts).toBe(1);
    expect(row?.last_error).toContain("delivery failed");
    // available_at pushed into the future → not immediately re-claimable.
    expect(row?.available_at.getTime()).toBeGreaterThan(Date.now());
  });

  it("dead-letters a row once attempts are exhausted", async () => {
    // One attempt away from the ceiling: the next failure crosses it.
    const id = await seedOutboxRow(acmeId, { attempts: OUTBOX_MAX_ATTEMPTS - 1 });
    const res = await drainOutboxForTenant(acmeId, { handler: new ThrowingHandler() });
    expect(res).toMatchObject({ claimed: 1, deadLettered: 1, rescheduled: 0 });

    const row = await readRow(acmeId, id);
    expect(row?.status).toBe("failed");
    expect(row?.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
  });

  it("never drains another tenant's events (RLS isolation)", async () => {
    const globexRowId = await seedOutboxRow(globexId);
    const handler = new RecordingHandler();

    // Draining acme sees none of globex's rows.
    const res = await drainOutboxForTenant(acmeId, { handler });
    expect(res.claimed).toBe(0);
    expect(handler.delivered).toHaveLength(0);

    // Globex's row is untouched — still pending.
    expect((await readRow(globexId, globexRowId))?.status).toBe("pending");
  });
});
