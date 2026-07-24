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
 *     This is the local/dev + self-hosted resolver; the var is injected by the
 *     deployment (compose, k8s secret, etc.). In cloud we would add an
 *     `awssm:<arn>` / `gcpsm:<name>` scheme backed by a secrets-manager client,
 *     behind this same interface — no caller changes.
 *
 * The resolved URL MUST authenticate as the dedicated database's `kaenal_app`
 * role (not its owner): RLS still runs in Model B as defence in depth (01 §3.1),
 * so a single-tenant database is scoped by RLS exactly like the shared one.
 */
export interface SecretResolver {
  resolve(ref: string): Promise<string>;
}

const ENV_REF = /^env:([A-Za-z_][A-Za-z0-9_]*)$/;

export class EnvSecretResolver implements SecretResolver {
  constructor(private readonly source: NodeJS.ProcessEnv = process.env) {}

  resolve(ref: string): Promise<string> {
    const match = ENV_REF.exec(ref);
    if (match === null || match[1] === undefined) {
      // Fail loud: an unrecognised scheme must never silently fall through to
      // the shared database or a partially-formed connection string.
      return Promise.reject(
        new Error(`Unsupported database_url_secret_ref scheme: '${ref.split(":")[0]}:'`),
      );
    }
    const value = this.source[match[1]];
    if (value === undefined || value === "") {
      // The name is safe to log; the value never is.
      return Promise.reject(
        new Error(`Dedicated-instance secret '${ref}' is not set in the environment`),
      );
    }
    return Promise.resolve(value);
  }
}
