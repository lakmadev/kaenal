// Local dev helper: add an INSPECTOR member to acme so the mobile app shows the
// Inspector home + the NCRs tab (the Admin tab set is Pulse/Approvals/Audit/Me).
import pg from "pg";
import { withTenant, closePools } from "@kaenal/db";
import { hashPassword } from "../apps/api/src/auth/passwords.js";

const EMAIL = "inspector@acme.test";
const PASSWORD = "demo-password-1234";

async function main(): Promise<void> {
  const control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const t = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = 'acme'");
  const acme = t.rows[0]?.id;
  if (!acme) throw new Error("acme tenant not provisioned");

  const hash = await hashPassword(PASSWORD);
  const u = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash)
     VALUES ($1, 'Demo Inspector', $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [EMAIL, hash],
  );
  const userId = u.rows[0]!.id;

  await withTenant(acme, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status)
       VALUES ($1, $2, 'inspector', '{}', 'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'inspector', status = 'active'`,
      [acme, userId],
    );
  });

  console.log(`Seeded inspector — sign in as ${EMAIL} / ${PASSWORD} (workspace: acme).`);
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
