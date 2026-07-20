import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePools, migratorPool, withTenant } from "../src/client.js";

/**
 * Shared identity: what replaced the guarantee RLS used to give (0003).
 *
 * While `users` was tenant-owned, referencing another tenant's user was
 * impossible because the row was invisible. `control.users` is global, so that
 * protection is gone and something must take its place: every user reference
 * in a tenant table is now a composite FK
 * `(tenant_id, col) -> memberships (tenant_id, user_id)`.
 *
 * These tests exist because `control.users` is exempt from the RLS schema lint
 * and from the dynamic tenancy suite — both enumerate tenant-owned tables, so
 * neither would notice if this table or its constraints regressed. An exempt
 * table with no explicit tests is an unguarded table.
 */

const TENANT_A = "019f0000-0000-7000-8000-0000000000e1";
const TENANT_B = "019f0000-0000-7000-8000-0000000000e2";

let alice = ""; // member of A only
let bob = ""; // member of B only
let carol = ""; // member of BOTH — the 07 §7 case

async function reset(): Promise<void> {
  const client = await migratorPool.connect();
  try {
    await client.query("TRUNCATE TABLE plants, ncrs, memberships, audit_events CASCADE");
    await client.query("TRUNCATE TABLE control.users CASCADE");
    for (const id of [TENANT_A, TENANT_B]) {
      await client.query(
        `INSERT INTO control.tenants (id, slug, name, model, region, status)
         VALUES ($1, $2, 'Fixture', 'shared', 'us-east-1', 'active')
         ON CONFLICT (id) DO NOTHING`,
        [id, `fixture-${id.slice(-4)}`],
      );
    }
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await reset();

  const client = await migratorPool.connect();
  try {
    const mk = async (email: string): Promise<string> => {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO control.users (email, name) VALUES ($1, $2) RETURNING id",
        [email, email],
      );
      return rows[0]?.id ?? "";
    };
    alice = await mk("alice@example.test");
    bob = await mk("bob@example.test");
    carol = await mk("carol@example.test");

    const join = (t: string, u: string, role = "manager"): Promise<unknown> =>
      client.query(
        `INSERT INTO memberships (tenant_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')`,
        [t, u, role],
      );

    await join(TENANT_A, alice);
    await join(TENANT_B, bob);
    await join(TENANT_A, carol, "admin");
    await join(TENANT_B, carol, "viewer");
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await reset();
  await closePools();
});

/** Creates an NCR in `tenant` owned by `userId`. */
async function createNcr(tenant: string, userId: string, code: string): Promise<void> {
  await withTenant(tenant, null, async (tx) => {
    await tx.query(
      `INSERT INTO ncrs (tenant_id, code, title, source, priority, status, owner_id)
       VALUES ($1, $2, 'Fixture NCR', 'manual', 'minor', 'draft', $3)`,
      [tenant, code, userId],
    );
  });
}

describe("a tenant row may only reference its OWN members", () => {
  it("accepts an owner who is a member of the tenant", async () => {
    await expect(createNcr(TENANT_A, alice, "NCR-2026-9001")).resolves.toBeUndefined();
  });

  it("REJECTS an owner who is a member of a different tenant", async () => {
    // The core of the migration. Bob exists and is a perfectly valid person,
    // but he is not a member of tenant A — before 0003 this was blocked by
    // RLS invisibility, and now by the composite FK.
    // Asserts the FK constraint BY NAME. A bare /violates/ would also match a
    // CHECK failure on some unrelated column, which would let a broken fixture
    // pass this test while proving nothing about cross-tenant references.
    await expect(createNcr(TENANT_A, bob, "NCR-2026-9002")).rejects.toThrow(
      /ncrs_owner_id_member_fk/,
    );
  });

  it("REJECTS an owner who exists globally but is a member of no tenant at all", async () => {
    const client = await migratorPool.connect();
    let stranger = "";
    try {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO control.users (email, name) VALUES ($1, $2) RETURNING id",
        ["stranger@example.test", "Stranger"],
      );
      stranger = rows[0]?.id ?? "";
    } finally {
      client.release();
    }

    await expect(createNcr(TENANT_A, stranger, "NCR-2026-9003")).rejects.toThrow(
      /ncrs_owner_id_member_fk/,
    );
  });

  it("REJECTS a user id that does not exist at all", async () => {
    await expect(
      createNcr(TENANT_A, "019f0000-0000-7000-8000-00000000dead", "NCR-2026-9004"),
    ).rejects.toThrow(/ncrs_owner_id_member_fk/);
  });

  it("allows a null owner", async () => {
    // Composite FKs use MATCH SIMPLE: a null in any column satisfies the
    // constraint, which is what keeps `owner_id` genuinely optional.
    await withTenant(TENANT_A, null, async (tx) => {
      await tx.query(
        `INSERT INTO ncrs (tenant_id, code, title, source, priority, status)
         VALUES ($1, 'NCR-2026-9005', 'Unowned', 'manual', 'minor', 'draft')`,
        [TENANT_A],
      );
    });
  });
});

describe("one person, two tenants (07 §7)", () => {
  it("is a single row in control.users", async () => {
    const client = await migratorPool.connect();
    try {
      const { rows } = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM control.users WHERE email = 'carol@example.test'",
      );
      expect(rows[0]?.n).toBe(1);
    } finally {
      client.release();
    }
  });

  it("holds a separate role in each tenant", async () => {
    const roleIn = (t: string): Promise<string | undefined> =>
      withTenant(t, null, async (tx) => {
        const { rows } = await tx.query<{ role: string }>(
          "SELECT role FROM memberships WHERE user_id = $1",
          [carol],
        );
        return rows[0]?.role;
      });

    // Admin at one customer, read-only at another — impossible under the
    // per-tenant user rows this migration replaced.
    expect(await roleIn(TENANT_A)).toBe("admin");
    expect(await roleIn(TENANT_B)).toBe("viewer");
  });

  it("can own records in both tenants", async () => {
    await expect(createNcr(TENANT_A, carol, "NCR-2026-9101")).resolves.toBeUndefined();
    await expect(createNcr(TENANT_B, carol, "NCR-2026-9102")).resolves.toBeUndefined();
  });

  it("still cannot see one tenant's records from the other", async () => {
    // Shared identity must not become shared data.
    const codes = await withTenant(TENANT_B, null, async (tx) => {
      const { rows } = await tx.query<{ code: string }>("SELECT code FROM ncrs");
      return rows.map((r) => r.code);
    });

    expect(codes).toContain("NCR-2026-9102");
    expect(codes).not.toContain("NCR-2026-9101");
  });
});

describe("memberships remain tenant-isolated", () => {
  it("a tenant sees only its own memberships", async () => {
    const emailsIn = (t: string): Promise<string[]> =>
      withTenant(t, null, async (tx) => {
        // Deliberately joins across the schema boundary, the way a real
        // members list will: control.users is unfiltered, so the isolation has
        // to come from the memberships side of the join.
        const { rows } = await tx.query<{ email: string }>(
          `SELECT u.email FROM memberships m
             JOIN control.users u ON u.id = m.user_id
            ORDER BY u.email`,
        );
        return rows.map((r) => r.email);
      });

    expect(await emailsIn(TENANT_A)).toEqual(["alice@example.test", "carol@example.test"]);
    expect(await emailsIn(TENANT_B)).toEqual(["bob@example.test", "carol@example.test"]);
  });

  it("a membership cannot be written into another tenant", async () => {
    await expect(
      withTenant(TENANT_A, null, async (tx) => {
        await tx.query(
          `INSERT INTO memberships (tenant_id, user_id, role, status)
           VALUES ($1, $2, 'admin', 'active')`,
          [TENANT_B, alice],
        );
      }),
    ).rejects.toThrow(/row-level security|violates/i);
  });
});

describe("the app role's reach into control", () => {
  it("can read and write control.users — it authenticates and manages profiles", async () => {
    await withTenant(TENANT_A, null, async (tx) => {
      await tx.query("UPDATE control.users SET name = 'Alice Updated' WHERE id = $1", [alice]);
    });
  });

  it("cannot DELETE from control.users", async () => {
    // Offboarding and DSAR anonymisation are deliberate, audited, migrator-
    // level operations (07 §5) — not something a request handler can do.
    await expect(
      withTenant(TENANT_A, null, async (tx) => {
        await tx.query("DELETE FROM control.users WHERE id = $1", [alice]);
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it("cannot write control.tenants", async () => {
    await expect(
      withTenant(TENANT_A, null, async (tx) => {
        await tx.query("UPDATE control.tenants SET status = 'suspended' WHERE id = $1", [TENANT_B]);
      }),
    ).rejects.toThrow(/permission denied/i);
  });
});
