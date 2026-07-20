import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePools, migratorPool, withTenant } from "../src/client.js";
import { diffFields, redact, REDACTED, withAudit } from "../src/audit.js";

/**
 * withAudit integration tests (02 §3, 07 §1).
 *
 * These run against real Postgres because the guarantee under test is
 * transactional atomicity — the one property a mocked database cannot
 * demonstrate.
 */

const TENANT = "019f0000-0000-7000-8000-0000000000a4";
const ACTOR = "019f0000-0000-7000-8000-0000000000a5";

async function reset(): Promise<void> {
  const client = await migratorPool.connect();
  try {
    await client.query("TRUNCATE TABLE plants, audit_events CASCADE");
  } finally {
    client.release();
  }
}

async function countRows(table: string): Promise<number> {
  return withTenant(TENANT, null, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    return rows[0]?.n ?? 0;
  });
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await closePools();
});

describe("withAudit — the mutation and its event commit together", () => {
  it("writes the audit event alongside the mutation", async () => {
    await withTenant(TENANT, ACTOR, async (tx) => {
      await withAudit(
        tx,
        TENANT,
        {
          actorId: ACTOR,
          actorKind: "user",
          entityKind: "plant",
          entityId: "019f0000-0000-7000-8000-0000000000c1",
          action: "created",
          after: { name: "Main Plant", code: "P-1" },
        },
        async (t) => {
          await t.query(
            `INSERT INTO plants (id, tenant_id, name, code)
             VALUES ('019f0000-0000-7000-8000-0000000000c1', $1, 'Main Plant', 'P-1')`,
            [TENANT],
          );
        },
      );
    });

    expect(await countRows("plants")).toBe(1);
    expect(await countRows("audit_events")).toBe(1);

    const event = await withTenant(TENANT, null, async (tx) => {
      const { rows } = await tx.query<{
        action: string;
        actor_kind: string;
        after: Record<string, unknown>;
      }>("SELECT action, actor_kind, after FROM audit_events LIMIT 1");
      return rows[0];
    });

    expect(event?.action).toBe("created");
    expect(event?.actor_kind).toBe("user");
    expect(event?.after).toEqual({ name: "Main Plant", code: "P-1" });
  });

  it("rolls back the audit event when the surrounding transaction fails", async () => {
    // The scenario rule 3 protects against: a mutation that appears to succeed
    // but whose trail is missing, or vice versa.
    await expect(
      withTenant(TENANT, ACTOR, async (tx) => {
        await withAudit(
          tx,
          TENANT,
          {
            actorId: ACTOR,
            actorKind: "user",
            entityKind: "plant",
            entityId: "019f0000-0000-7000-8000-0000000000c2",
            action: "created",
          },
          async (t) => {
            await t.query(
              `INSERT INTO plants (id, tenant_id, name, code)
               VALUES ('019f0000-0000-7000-8000-0000000000c2', $1, 'Doomed', 'P-2')`,
              [TENANT],
            );
          },
        );
        throw new Error("something downstream failed");
      }),
    ).rejects.toThrow("something downstream failed");

    expect(await countRows("plants"), "the mutation should have rolled back").toBe(0);
    expect(await countRows("audit_events"), "the audit event should have rolled back too").toBe(0);
  });

  it("rolls back the mutation when the audit insert fails", async () => {
    await expect(
      withTenant(TENANT, ACTOR, async (tx) => {
        await withAudit(
          tx,
          TENANT,
          {
            actorId: ACTOR,
            actorKind: "user",
            entityKind: "plant",
            entityId: "019f0000-0000-7000-8000-0000000000c3",
            // Not in the CHECK constraint's value list — the audit insert fails.
            action: "not_a_real_action" as never,
          },
          async (t) => {
            await t.query(
              `INSERT INTO plants (id, tenant_id, name, code)
               VALUES ('019f0000-0000-7000-8000-0000000000c3', $1, 'Orphan', 'P-3')`,
              [TENANT],
            );
          },
        );
      }),
    ).rejects.toThrow();

    expect(await countRows("plants"), "a mutation must not survive a failed audit write").toBe(0);
  });

  it("writes several events for one mutation", async () => {
    await withTenant(TENANT, ACTOR, async (tx) => {
      await withAudit(
        tx,
        TENANT,
        [
          {
            actorId: ACTOR,
            actorKind: "user",
            entityKind: "plant",
            entityId: "019f0000-0000-7000-8000-0000000000c4",
            action: "created",
          },
          {
            actorId: ACTOR,
            actorKind: "user",
            entityKind: "plant",
            entityId: "019f0000-0000-7000-8000-0000000000c4",
            action: "assigned",
          },
        ],
        async (t) => {
          await t.query(
            `INSERT INTO plants (id, tenant_id, name, code)
             VALUES ('019f0000-0000-7000-8000-0000000000c4', $1, 'Multi', 'P-4')`,
            [TENANT],
          );
        },
      );
    });

    expect(await countRows("audit_events")).toBe(2);
  });

  it("refuses a mutation that records no events at all", async () => {
    await expect(
      withTenant(TENANT, ACTOR, async (tx) => {
        await withAudit(tx, TENANT, [], async () => undefined);
      }),
    ).rejects.toThrow(/must record at least one/i);
  });

  it("refuses a support-actor event with no reason", async () => {
    await expect(
      withTenant(TENANT, ACTOR, async (tx) => {
        await withAudit(
          tx,
          TENANT,
          {
            actorId: ACTOR,
            actorKind: "support",
            entityKind: "plant",
            entityId: "019f0000-0000-7000-8000-0000000000c5",
            action: "support_accessed",
          },
          async () => undefined,
        );
      }),
    ).rejects.toThrow(/require a reason/i);
  });

  it("accepts a support-actor event with a reason", async () => {
    await withTenant(TENANT, ACTOR, async (tx) => {
      await withAudit(
        tx,
        TENANT,
        {
          actorId: ACTOR,
          actorKind: "support",
          entityKind: "plant",
          entityId: "019f0000-0000-7000-8000-0000000000c6",
          action: "support_accessed",
          reason: "Ticket #4821 — customer asked us to inspect a stuck NCR",
        },
        async () => undefined,
      );
    });

    expect(await countRows("audit_events")).toBe(1);
  });
});

describe("redaction (02 §3)", () => {
  it("redacts credential-shaped fields", async () => {
    await withTenant(TENANT, ACTOR, async (tx) => {
      await withAudit(
        tx,
        TENANT,
        {
          actorId: ACTOR,
          actorKind: "user",
          entityKind: "user",
          entityId: "019f0000-0000-7000-8000-0000000000c7",
          action: "updated",
          after: { name: "Ada", password_hash: "$2b$12$verysecret", mfa_secret: "JBSWY3DP" },
        },
        async () => undefined,
      );
    });

    const after = await withTenant(TENANT, null, async (tx) => {
      const { rows } = await tx.query<{ after: Record<string, unknown> }>(
        "SELECT after FROM audit_events LIMIT 1",
      );
      return rows[0]?.after;
    });

    // The history tab is visible to every tenant admin — a credential that
    // reaches it is a credential disclosed.
    expect(after).toEqual({ name: "Ada", password_hash: REDACTED, mfa_secret: REDACTED });
  });

  it.each(["password", "password_hash", "refresh_token", "api_key", "secret", "mfaSecret"])(
    "redacts %s",
    (key) => {
      expect(redact({ [key]: "sensitive" })[key]).toBe(REDACTED);
    },
  );

  it("leaves ordinary fields alone", () => {
    expect(redact({ title: "Weld porosity", status: "open" })).toEqual({
      title: "Weld porosity",
      status: "open",
    });
  });

  it("maps null to null", () => {
    expect(redact(null)).toBeNull();
  });
});

describe("diffFields", () => {
  it("keeps only what changed", () => {
    const result = diffFields(
      { status: "open", title: "Weld porosity", owner: "u1" },
      { status: "assigned", title: "Weld porosity", owner: "u1" },
    );
    expect(result).toEqual({ before: { status: "open" }, after: { status: "assigned" } });
  });

  it("returns empty objects when nothing changed", () => {
    const result = diffFields({ status: "open" }, { status: "open" });
    expect(result).toEqual({ before: {}, after: {} });
  });

  it("records added and removed keys", () => {
    const result = diffFields({ a: 1 }, { b: 2 });
    expect(result.before).toEqual({ a: 1, b: undefined });
    expect(result.after).toEqual({ a: undefined, b: 2 });
  });

  it("treats an equal Date and ISO string as unchanged", () => {
    // pg returns timestamptz as Date; request bodies carry ISO strings. Without
    // this, every update would log a spurious timestamp change.
    const d = new Date("2026-06-15T10:00:00.000Z");
    expect(diffFields({ dueAt: d }, { dueAt: "2026-06-15T10:00:00.000Z" })).toEqual({
      before: {},
      after: {},
    });
  });

  it("detects a genuine date change", () => {
    const before = new Date("2026-06-15T10:00:00.000Z");
    const after = new Date("2026-06-16T10:00:00.000Z");
    expect(diffFields({ dueAt: before }, { dueAt: after }).after).toEqual({ dueAt: after });
  });

  it("compares nested objects structurally", () => {
    expect(diffFields({ impact: { cost: 100 } }, { impact: { cost: 100 } })).toEqual({
      before: {},
      after: {},
    });
    expect(diffFields({ impact: { cost: 100 } }, { impact: { cost: 200 } }).after).toEqual({
      impact: { cost: 200 },
    });
  });
});
