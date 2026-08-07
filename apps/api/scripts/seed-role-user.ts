/**
 * Seed (or update) a single internal user with a given role in a tenant, for
 * manually exercising role-based UI (RBAC) in dev. Idempotent.
 *
 *   DATABASE_URL=postgres://kaenal_migrator:...@localhost:5433/kaenal \
 *     pnpm --filter @kaenal/api exec tsx scripts/seed-role-user.ts inspector
 *
 * Args: [role] [email] [tenantSlug]   (defaults: inspector, <role>@acme.test, acme)
 * Password is always the demo password so it's easy to sign in with.
 * Internal roles only — a `partner` needs a supplier scope + MFA (use the portal
 * onboarding path), so this refuses it.
 */
import pg from "pg";
import { hashPassword } from "../src/auth/passwords.js";

const INTERNAL_ROLES = new Set(["admin", "manager", "auditor", "inspector", "viewer"]);
const PASSWORD = "demo-password-1234";

async function main(): Promise<void> {
  const role = process.argv[2] ?? "inspector";
  const tenantSlug = process.argv[4] ?? "acme";
  const email = process.argv[3] ?? `${role}@acme.test`;

  if (!INTERNAL_ROLES.has(role)) {
    throw new Error(`role must be one of ${[...INTERNAL_ROLES].join(", ")} (got '${role}')`);
  }
  const url = process.env["DATABASE_URL"];
  if (url === undefined || url === "") throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({ connectionString: url });
  try {
    const t = await pool.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [tenantSlug]);
    const tenantId = t.rows[0]?.id;
    if (tenantId === undefined) throw new Error(`tenant '${tenantSlug}' not found`);

    const hash = await hashPassword(PASSWORD);
    const u = await pool.query<{ id: string }>(
      `INSERT INTO control.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
       RETURNING id`,
      [email, `Test ${role[0]!.toUpperCase()}${role.slice(1)}`, hash],
    );
    const userId = u.rows[0]!.id;

    await pool.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tenantId, userId, role],
    );

    console.log(`Seeded ${role} '${email}' / ${PASSWORD} in workspace '${tenantSlug}'.`);
  } finally {
    await pool.end();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
