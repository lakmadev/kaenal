import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

/**
 * The API's pool. Runs as `kaenal_app`: not the table owner, no BYPASSRLS —
 * so RLS applies to every statement it issues, including ones with a bug in
 * their WHERE clause.
 */
export const appPool = new Pool({ connectionString: env.DATABASE_APP_URL });

/** Owner pool. Migrations and provisioning only — never serves requests. */
export const migratorPool = new Pool({ connectionString: env.DATABASE_URL });

export type Tx = pg.PoolClient;

/**
 * Runs `fn` inside a transaction scoped to one tenant.
 *
 * `SET LOCAL` (not `SET`) is load-bearing (01 §3.3): under a connection pooler
 * in transaction mode, a plain `SET` outlives the transaction and can leak the
 * previous request's tenant onto the next request that borrows the connection.
 * `SET LOCAL` is scoped to the transaction and reverts on COMMIT/ROLLBACK, so
 * the setting can never outlive the work it was scoped to.
 *
 * Values are passed as parameters via set_config() rather than interpolated
 * into the SET statement, which has no parameter form and would otherwise be
 * a string-concatenation site.
 */
export async function withTenant<T>(
  tenantId: string,
  userId: string | null,
  fn: (tx: Tx) => Promise<T>,
  pool: pg.Pool = appPool,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // third arg `true` = is_local, i.e. the SET LOCAL equivalent
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    if (userId !== null) {
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    }
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transaction with NO tenant scope, for the control plane and migrations.
 * Any query against a tenant table from here throws, because
 * current_setting('app.tenant_id') is unset — which is the intended
 * behaviour, not an inconvenience (02 §1).
 */
export async function withoutTenant<T>(
  fn: (tx: Tx) => Promise<T>,
  pool: pg.Pool = migratorPool,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePools(): Promise<void> {
  await Promise.all([appPool.end(), migratorPool.end()]);
}
