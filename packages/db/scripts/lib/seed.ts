/**
 * Tenant seed defaults + the RLS smoke test (01 §3.4), shared by shared-model
 * and dedicated-model provisioning. Both run through `withTenant` against a
 * given pool: for Model A that is the primary app pool, for Model B a pool to
 * the tenant's own database. Seeding inside the tenant's RLS scope means the
 * seed itself proves the policies accept legitimate writes.
 */
import { randomBytes } from "node:crypto";
import type pg from "pg";
import { withTenant } from "../../src/client.js";

/** Default SLA ladder, in business hours. Tenants tune this in settings. */
const DEFAULT_SLA = [
  { entityKind: "ncr", priority: "critical", respond: 4, resolve: 24, escalateTo: "admin" },
  { entityKind: "ncr", priority: "major", respond: 8, resolve: 72, escalateTo: "manager" },
  { entityKind: "ncr", priority: "minor", respond: 24, resolve: 168, escalateTo: "manager" },
] as const;

const DEFAULT_BUSINESS_HOURS = {
  // Mon–Fri 08:00–17:00 in the tenant's timezone. computeDueAt() in
  // packages/core walks these when deriving due dates.
  days: [1, 2, 3, 4, 5],
  start: "08:00",
  end: "17:00",
};

const EXAMPLE_TEMPLATE_SCHEMA = {
  sections: [
    {
      id: "s1",
      title: "Housekeeping",
      items: [
        {
          id: "i1",
          type: "pass_fail",
          label: "Walkways clear of obstruction",
          required: true,
          weight: 1,
          finding_trigger: { on: "fail", severity: "minor" },
        },
        {
          id: "i2",
          type: "pass_fail",
          label: "PPE worn correctly",
          required: true,
          weight: 2,
          finding_trigger: { on: "fail", severity: "major" },
        },
        { id: "i3", type: "photo", label: "Evidence photo", required: false },
      ],
    },
  ],
};

export interface SeedOptions {
  readonly tenantId: string;
  readonly slug: string;
  readonly timezone: string;
  readonly pool: pg.Pool;
}

/** Seeds SLA config, a default plant, an example template, and the admin invite. */
export async function seedTenantDefaults(opts: SeedOptions): Promise<void> {
  const { tenantId, slug, timezone, pool } = opts;

  await withTenant(
    tenantId,
    null,
    async (tx) => {
      for (const sla of DEFAULT_SLA) {
        await tx.query(
          `INSERT INTO sla_configs (tenant_id, entity_kind, priority, respond_hours, resolve_hours,
                                    escalate_to_role, business_hours)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (tenant_id, entity_kind, priority) DO NOTHING`,
          [
            tenantId,
            sla.entityKind,
            sla.priority,
            sla.respond,
            sla.resolve,
            sla.escalateTo,
            JSON.stringify(DEFAULT_BUSINESS_HOURS),
          ],
        );
      }

      await tx.query(
        `INSERT INTO plants (tenant_id, name, code, timezone)
         VALUES ($1, 'Main Plant', 'PLANT-1', $2)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [tenantId, timezone],
      );

      await tx.query(
        `INSERT INTO inspection_templates (tenant_id, name, version, status, schema)
         VALUES ($1, 'Line Safety Walk', 1, 'published', $2)
         ON CONFLICT (tenant_id, name, version) DO NOTHING`,
        [tenantId, JSON.stringify(EXAMPLE_TEMPLATE_SCHEMA)],
      );

      // The first admin. The person is global (control.users); the membership is
      // what makes them an admin HERE. Membership stays 'invited' until the
      // invite is accepted — provisioning never creates a usable credential.
      await tx.query(
        `INSERT INTO control.users (email, name)
         VALUES ($1, 'Administrator')
         ON CONFLICT (email) DO NOTHING`,
        [`admin@${slug}.invalid`],
      );

      await tx.query(
        `INSERT INTO memberships (tenant_id, user_id, role, status)
         SELECT $1, u.id, 'admin', 'invited' FROM control.users u WHERE u.email = $2
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [tenantId, `admin@${slug}.invalid`],
      );
    },
    pool,
  );
}

/**
 * Inserts a canary row as this tenant, then asserts a different tenant scope
 * cannot see it. Exercises the real policy rather than trusting the migration
 * ran. Throws if isolation is broken — the caller must not ship the database.
 */
export async function smokeTestIsolation(tenantId: string, pool: pg.Pool): Promise<void> {
  const otherTenantId = "00000000-0000-7000-8000-0000000000ff";
  const canaryCode = `SMOKE-${randomBytes(4).toString("hex")}`;

  await withTenant(
    tenantId,
    null,
    (tx) =>
      tx.query(`INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'RLS smoke canary', $2)`, [
        tenantId,
        canaryCode,
      ]),
    pool,
  );

  const visibleToOther = await withTenant(
    otherTenantId,
    null,
    async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM plants WHERE code = $1",
        [canaryCode],
      );
      return rows[0]?.n ?? 0;
    },
    pool,
  );

  await withTenant(
    tenantId,
    null,
    (tx) => tx.query("DELETE FROM plants WHERE code = $1", [canaryCode]),
    pool,
  );

  if (visibleToOther !== 0) {
    throw new Error(
      `RLS smoke test FAILED: canary row was visible to another tenant scope. ` +
        `Do not use this database.`,
    );
  }
}
