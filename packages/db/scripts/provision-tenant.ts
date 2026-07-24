/**
 * Tenant provisioning (01 §3.4).
 *
 *   pnpm provision-tenant --slug bosch --name "Bosch" --model shared --region eu-central-1
 *   pnpm provision-tenant --slug bosch --name "Bosch" --model dedicated
 *
 * Idempotent — re-running against an existing slug re-seeds defaults without
 * duplicating them, so a partial failure can simply be retried.
 *
 * Shared (Model A): registry row + seed into the primary DB under RLS.
 * Dedicated (Model B): a whole database is created, migrated, seeded and
 * smoke-tested, then registered with a `localdb:` secret ref — see
 * `lib/provision-dedicated.ts`.
 *
 * If any step throws, the registry row is parked at `provisioning_failed`
 * rather than left `active`: a half-provisioned tenant that accepts logins is
 * worse than one that visibly failed.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { TenancyModel, TenantSlug } from "@kaenal/types";
import { appPool, closePools, migratorPool } from "../src/client.js";
import { env } from "../src/env.js";
import { seedTenantDefaults, smokeTestIsolation } from "./lib/seed.js";
import { provisionDedicatedTenant } from "./lib/provision-dedicated.js";

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

const region = values.region ?? "us-east-1";
const timezone = values.timezone ?? "UTC";

function printReady(): void {
  console.log(`\n✓ Tenant ready: https://${slug}.kaenal.app`);
  const inviteToken = randomBytes(32).toString("base64url");
  console.log(
    `  Admin invite: ${process.env.APP_BASE_URL ?? "http://localhost:3000"}/invite/${inviteToken}`,
  );
  console.log(`  (Invite delivery lands with the auth module — token is not yet persisted.)`);
}

async function provisionShared(): Promise<void> {
  const client = await migratorPool.connect();
  let tenantId: string | undefined;
  try {
    const { rows } = await client.query<{ id: string; existed: boolean }>(
      `INSERT INTO control.tenants (slug, name, model, region, timezone, status)
       VALUES ($1, $2, 'shared', $3, $4, 'active')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id, (xmax <> 0) AS existed`,
      [slug, name, region, timezone],
    );
    const row = rows[0];
    if (!row) throw new Error("registry insert returned no row");
    tenantId = row.id;

    console.log(
      row.existed
        ? `→ Tenant '${slug}' already exists (${tenantId}); re-seeding defaults.`
        : `→ Created tenant '${slug}' (${tenantId}).`,
    );

    await seedTenantDefaults({ tenantId, slug, timezone, pool: appPool });
    console.log("→ Seeded SLA config, default plant, example template, admin invite.");

    await smokeTestIsolation(tenantId, appPool);
    console.log("→ RLS smoke test passed (tenant cannot see other tenants' rows).");

    printReady();
  } catch (err) {
    if (tenantId) {
      await client.query("UPDATE control.tenants SET status = 'provisioning_failed' WHERE id = $1", [
        tenantId,
      ]);
      console.error(`\n✗ Provisioning failed — tenant parked at status='provisioning_failed'.`);
    }
    throw err;
  } finally {
    client.release();
  }
}

async function provisionDedicated(): Promise<void> {
  const primary = await migratorPool.connect();
  try {
    const result = await provisionDedicatedTenant({
      slug,
      name,
      region,
      timezone,
      baseMigratorUrl: env.DATABASE_URL,
      baseAppUrl: env.DATABASE_APP_URL,
      primary,
      log: (msg) => console.log(msg),
    });
    printReady();
    console.log(`  Dedicated database: ${result.dbName} (secret ref: ${result.secretRef}).`);
  } catch (err) {
    console.error(
      `\n✗ Dedicated provisioning failed — tenant parked at status='provisioning_failed'.`,
    );
    throw err;
  } finally {
    primary.release();
  }
}

async function main(): Promise<void> {
  try {
    if (model === "dedicated") {
      await provisionDedicated();
    } else {
      await provisionShared();
    }
  } finally {
    await closePools();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
