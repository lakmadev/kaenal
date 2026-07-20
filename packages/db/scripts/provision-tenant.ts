/**
 * Tenant provisioning (01 §3.4).
 *
 *   pnpm provision-tenant --slug bosch --name "Bosch" --model shared --region eu-central-1
 *
 * Idempotent — re-running against an existing slug re-seeds defaults without
 * duplicating them, so a partial failure can simply be retried.
 *
 * If any step throws, the registry row is parked at `provisioning_failed`
 * rather than left `active`: a half-provisioned tenant that accepts logins is
 * worse than one that visibly failed.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { TenancyModel, TenantSlug } from "@kaenal/types";
import { migratorPool, withTenant } from "../src/client.js";

const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    name: { type: "string" },
    model: { type: "string", default: "shared" },
    region: { type: "string", default: "us-east-1" },
    timezone: { type: "string", default: "UTC" },
  },
});

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const slugResult = TenantSlug.safeParse(values.slug);
if (!slugResult.success) {
  fail(`--slug is invalid: ${slugResult.error.issues.map((i) => i.message).join("; ")}`);
}
const slug = slugResult.data;

if (!values.name) fail("--name is required");
const name = values.name;

const modelResult = TenancyModel.safeParse(values.model);
if (!modelResult.success) fail("--model must be 'shared' or 'dedicated'");
const model = modelResult.data;

if (model === "dedicated") {
  fail(
    "Model B (dedicated instance) provisioning is not implemented yet — it needs the " +
      "per-tenant database creation + migration fan-out from 01 §3.4. Use --model shared.",
  );
}

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

async function main(): Promise<void> {
  const client = await migratorPool.connect();
  let tenantId: string | undefined;

  try {
    // --- 1. Registry row (control plane) ------------------------------------
    const { rows } = await client.query<{ id: string; existed: boolean }>(
      `INSERT INTO control.tenants (slug, name, model, region, timezone, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id, (xmax <> 0) AS existed`,
      [slug, name, model, values.region, values.timezone],
    );

    const row = rows[0];
    if (!row) throw new Error("registry insert returned no row");
    tenantId = row.id;

    console.log(
      row.existed
        ? `→ Tenant '${slug}' already exists (${tenantId}); re-seeding defaults.`
        : `→ Created tenant '${slug}' (${tenantId}).`,
    );

    // --- 2. Seed defaults, inside the tenant's own RLS scope ----------------
    // Seeding through withTenant rather than as the owner means the seed data
    // itself proves the policies accept legitimate writes.
    const inviteToken = randomBytes(32).toString("base64url");

    await withTenant(tenantId, null, async (tx) => {
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
        [tenantId, values.timezone],
      );

      await tx.query(
        `INSERT INTO inspection_templates (tenant_id, name, version, status, schema)
         VALUES ($1, 'Line Safety Walk', 1, 'published', $2)
         ON CONFLICT (tenant_id, name, version) DO NOTHING`,
        [
          tenantId,
          JSON.stringify({
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
          }),
        ],
      );

      // The first admin. Status stays 'invited' until the invite is accepted —
      // provisioning never creates a usable credential (03 §2).
      await tx.query(
        `INSERT INTO users (tenant_id, email, name, status)
         VALUES ($1, $2, 'Administrator', 'invited')
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [tenantId, `admin@${slug}.invalid`],
      );

      await tx.query(
        `INSERT INTO memberships (tenant_id, user_id, role)
         SELECT $1, u.id, 'admin' FROM users u WHERE u.tenant_id = $1 AND u.email = $2
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [tenantId, `admin@${slug}.invalid`],
      );
    });

    console.log("→ Seeded SLA config, default plant, example template, admin invite.");

    // --- 3. RLS smoke test --------------------------------------------------
    // Provisioning asserts isolation for THIS tenant before handing over the
    // invite link, so a policy regression can't ship a live tenant.
    await smokeTestIsolation(tenantId);
    console.log("→ RLS smoke test passed (tenant cannot see other tenants' rows).");

    console.log(`\n✓ Tenant ready: https://${slug}.kaenal.app`);
    console.log(`  Admin invite: ${process.env.APP_BASE_URL ?? "http://localhost:3000"}` +
      `/invite/${inviteToken}`);
    console.log(`  (Invite delivery lands with the auth module — token is not yet persisted.)`);
  } catch (err) {
    if (tenantId) {
      await client.query(
        "UPDATE control.tenants SET status = 'provisioning_failed' WHERE id = $1",
        [tenantId],
      );
      console.error(`\n✗ Provisioning failed — tenant parked at status='provisioning_failed'.`);
    }
    throw err;
  } finally {
    client.release();
    await migratorPool.end();
  }
}

/**
 * Inserts a canary row as this tenant, then asserts a different tenant scope
 * cannot see it. Cheap, and it exercises the real policy rather than trusting
 * that the migration ran.
 */
async function smokeTestIsolation(tenantId: string): Promise<void> {
  const otherTenantId = "00000000-0000-7000-8000-0000000000ff";
  const canaryCode = `SMOKE-${randomBytes(4).toString("hex")}`;

  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'RLS smoke canary', $2)`,
      [tenantId, canaryCode],
    );
  });

  const visibleToOther = await withTenant(otherTenantId, null, async (tx) => {
    const { rows } = await tx.query("SELECT count(*)::int AS n FROM plants WHERE code = $1", [
      canaryCode,
    ]);
    return rows[0]?.n ?? 0;
  });

  await withTenant(tenantId, null, async (tx) => {
    await tx.query("DELETE FROM plants WHERE code = $1", [canaryCode]);
  });

  if (visibleToOther !== 0) {
    throw new Error(
      `RLS smoke test FAILED: canary row was visible to another tenant scope. ` +
        `Do not use this database.`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
