// One-off local dev helper: activate the intelligence pack + allow AI for the
// `acme` tenant so the governed gateway lets the "Photo + AI" vision call through.
// Uses withTenant (app role, RLS-scoped) exactly like the test seeds.
import pg from "pg";
import { withTenant, closePools } from "@kaenal/db";

async function main(): Promise<void> {
  const control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = 'acme'");
  const acme = rows[0]?.id;
  if (!acme) throw new Error("acme tenant not provisioned");

  await withTenant(acme, null, async (tx) => {
    await tx.query(
      `INSERT INTO entitlements (tenant_id, pack_id, active, activated_at)
       VALUES ($1, 'intelligence', true, now())
       ON CONFLICT (tenant_id, pack_id) DO UPDATE SET active = true, activated_at = now(), updated_at = now()`,
      [acme],
    );
    await tx.query(
      `INSERT INTO ai_settings (tenant_id, allow_ai, pii_redaction)
       VALUES ($1, true, true)
       ON CONFLICT (tenant_id) DO UPDATE SET allow_ai = true, updated_at = now()`,
      [acme],
    );
  });

  console.log("acme: intelligence pack active + allow_ai=true");
  await control.end();
  await closePools();
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
