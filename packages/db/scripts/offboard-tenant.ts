/**
 * Tenant offboarding — initiate (01 §3.4, 07 §5).
 *
 *   pnpm offboard-tenant --slug bosch
 *
 * Flips the registry to `offboarding` (which blocks logins — the registry only
 * resolves `active` tenants) and starts the 30-day grace clock. It does NOT
 * delete anything: the nightly `offboardTenant` housekeeping job takes the
 * export bundle and performs the purge once the grace elapses and no legal hold
 * is active. Idempotent — re-running a tenant already `offboarding` leaves the
 * original grace start intact.
 *
 * The registry caches lookups for 60s, so a currently-cached `active` entry may
 * keep resolving for up to that TTL before logins are blocked.
 */
import { parseArgs } from "node:util";
import { TenantSlug } from "@kaenal/types";
import { migratorPool } from "../src/client.js";

/** Mirrors OFFBOARDING_GRACE_DAYS in @kaenal/core (the job enforces it); kept
 *  literal here so this CLI needs no dependency on core. */
const OFFBOARDING_GRACE_DAYS = 30;

const { values } = parseArgs({ options: { slug: { type: "string" } } });

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const slugResult = TenantSlug.safeParse(values.slug);
if (!slugResult.success) {
  fail(`--slug is invalid: ${slugResult.error.issues.map((i) => i.message).join("; ")}`);
}
const slug = slugResult.data;

async function main(): Promise<void> {
  const client = await migratorPool.connect();
  try {
    const { rows } = await client.query<{ id: string; status: string; offboarding_at: Date | null }>(
      "SELECT id, status, offboarding_at FROM control.tenants WHERE slug = $1",
      [slug],
    );
    const tenant = rows[0];
    if (tenant === undefined) fail(`No tenant with slug '${slug}'.`);

    if (tenant.status === "offboarded") {
      fail(`Tenant '${slug}' is already offboarded (data purged) — nothing to do.`);
    }
    if (tenant.status === "offboarding") {
      console.log(
        `→ Tenant '${slug}' is already offboarding since ${tenant.offboarding_at?.toISOString() ?? "unknown"}; grace unchanged.`,
      );
      return;
    }

    const { rows: updated } = await client.query<{ offboarding_at: Date }>(
      `UPDATE control.tenants
          SET status = 'offboarding', offboarding_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING offboarding_at`,
      [tenant.id],
    );
    const startedAt = updated[0]!.offboarding_at;
    const purgeAfter = new Date(startedAt.getTime() + OFFBOARDING_GRACE_DAYS * 24 * 60 * 60 * 1000);

    console.log(`✓ Tenant '${slug}' set to offboarding.`);
    console.log(`  Logins are now blocked (registry resolves only active tenants; ≤60s cache lag).`);
    console.log(`  Grace: ${OFFBOARDING_GRACE_DAYS} days — export + purge run after ${purgeAfter.toISOString()}.`);
    console.log(`  A legal hold will block the purge until released (07 §5).`);
  } finally {
    client.release();
    await migratorPool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
