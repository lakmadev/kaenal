/**
 * Shared helpers for Model B (dedicated Postgres per tenant, 01 §3.1) — used by
 * both the provisioning CLI and the migration fan-out.
 *
 * Local/self-hosted convention: every dedicated database lives on the SAME
 * cluster as the primary and is reachable with the primary's credentials. That
 * makes the tenant's slug the single source of truth: the database name, the
 * migrator URL, the app URL, and the registry secret ref are all derived from
 * it, so provisioning and fan-out never disagree about where a tenant lives.
 * (A cloud deployment that puts dedicated DBs on separate hosts would instead
 * store an `env:`/`awssm:` secret ref and a per-tenant migrator URL; this
 * convention is the local path, matched by the API's `localdb:` resolver.)
 */

/** Postgres identifiers cap at 63 bytes; `kaenal_ded_` (11) + slug (≤40) fits. */
export function dedicatedDbName(slug: string): string {
  // Slugs are `[a-z0-9-]` (validated upstream); `-` is illegal in an unquoted
  // identifier, so fold it to `_`. Slugs never contain `_`, so this is
  // injective — two slugs can't collide on a database name.
  const name = `kaenal_ded_${slug.replace(/-/g, "_")}`;
  if (!/^[a-z0-9_]+$/.test(name)) {
    // Defence in depth: the name is interpolated into `CREATE DATABASE` (which
    // has no parameter form), so it must be provably identifier-safe.
    throw new Error(`Refusing unsafe dedicated database name derived from slug '${slug}'`);
  }
  return name;
}

/** The registry secret ref the API's `localdb:` resolver understands. */
export function localDbSecretRef(dbName: string): string {
  return `localdb:${dbName}`;
}

/** Swap the database name in a Postgres connection URL, keeping everything else. */
export function withDatabaseName(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}
