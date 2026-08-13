/**
 * DEV ONLY. Resets every ACTIVE membership's user to the shared demo password so
 * the local credentials sheet is usable. Never run against a real environment.
 *   DATABASE_URL=postgres://kaenal_migrator:...@localhost:5433/kaenal \
 *     pnpm --filter @kaenal/api exec tsx scripts/reset-dev-passwords.ts
 */
import pg from "pg";
import { hashPassword } from "../src/auth/passwords.js";

const PASSWORD = "demo-password-1234";

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (url === undefined || url === "") throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: url });
  try {
    const hash = await hashPassword(PASSWORD);
    const { rows } = await pool.query<{ email: string }>(
      `UPDATE control.users u SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL
        WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.status = 'active')
        RETURNING u.email`,
      [hash],
    );
    console.log(`Reset ${rows.length} active users to '${PASSWORD}'.`);
  } finally {
    await pool.end();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
