/**
 * Resolves a tenant's `database_url_secret_ref` (control.tenants, 01 §3.2) to
 * an actual Postgres connection string for a Model B (dedicated) instance.
 *
 * The registry stores a *reference*, never the credential itself — so a leak of
 * the control plane never leaks connection strings (07 §4). This indirection is
 * the whole point of the `_secret_ref` naming.
 *
 * The reference is a scheme-prefixed pointer:
 *   - `env:VAR_NAME` — the connection string lives in that environment variable.
 *     The deployment injects it (compose, k8s secret, etc.); the var can point a
 *     dedicated tenant at a database on any host. This is the cloud path.
 *   - `localdb:DB_NAME` — the dedicated database lives on the SAME cluster as the
 *     primary, reachable with the primary's app credentials. The URL is derived
 *     from `DATABASE_APP_URL` by swapping the database name. This is what the
 *     provisioning CLI writes for local/self-hosted dedicated tenants, so no
 *     per-tenant env var has to be wired up.
 *
 * A cloud `awssm:<arn>` / `gcpsm:<name>` scheme backed by a secrets-manager
 * client drops in the same way — no caller changes.
 *
 * The resolved URL MUST authenticate as the dedicated database's `kaenal_app`
 * role (not its owner): RLS still runs in Model B as defence in depth (01 §3.1),
 * so a single-tenant database is scoped by RLS exactly like the shared one.
 */
export interface SecretResolver {
  resolve(ref: string): Promise<string>;
}

const ENV_REF = /^env:([A-Za-z_][A-Za-z0-9_]*)$/;
const LOCALDB_REF = /^localdb:([a-z0-9_]+)$/;

/** Swap the database name in a Postgres connection URL, keeping everything else. */
export function withDatabaseName(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

export class EnvSecretResolver implements SecretResolver {
  constructor(private readonly source: NodeJS.ProcessEnv = process.env) {}

  resolve(ref: string): Promise<string> {
    const local = LOCALDB_REF.exec(ref);
    if (local !== null && local[1] !== undefined) {
      const base = this.source["DATABASE_APP_URL"];
      if (base === undefined || base === "") {
        return Promise.reject(new Error(`Cannot resolve '${ref}': DATABASE_APP_URL is not set`));
      }
      return Promise.resolve(withDatabaseName(base, local[1]));
    }

    const env = ENV_REF.exec(ref);
    if (env !== null && env[1] !== undefined) {
      const value = this.source[env[1]];
      if (value === undefined || value === "") {
        // The name is safe to log; the value never is.
        return Promise.reject(
          new Error(`Dedicated-instance secret '${ref}' is not set in the environment`),
        );
      }
      return Promise.resolve(value);
    }

    // Fail loud: an unrecognised scheme must never silently fall through to the
    // shared database or a partially-formed connection string.
    return Promise.reject(
      new Error(`Unsupported database_url_secret_ref scheme: '${ref.split(":")[0]}:'`),
    );
  }
}
