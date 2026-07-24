import type pg from "pg";
import type { TenantPoolManager } from "./pool-manager.js";

/**
 * Resolves which database pool a tenant's data lives in, keyed by tenant id
 * (01 §3.1). The request path already knows the answer — the interceptor
 * resolves the tenant by slug and hands the pool to `withTenant`. Background
 * jobs and the AI gateway only have a tenant id, so they route through here.
 *
 * `undefined` means "use the shared default pool" (Model A) — the common case —
 * so callers pass the result straight to `withTenant(tenantId, userId, fn, pool)`
 * where an undefined pool falls back to `@kaenal/db`'s shared `appPool`.
 */
export interface TenantDbRouter {
  poolFor(tenantId: string): Promise<pg.Pool | undefined>;
}

interface CacheEntry {
  readonly model: string;
  readonly secretRef: string | null;
  readonly at: number;
}

/**
 * Registry-backed router. Looks up a tenant's model + connection secret from the
 * control plane and, for a dedicated tenant, returns its per-tenant pool from the
 * `TenantPoolManager`. The model/secret lookup is cached briefly (a job sweep
 * fans out many jobs for the same tenants), while the pool itself is owned and
 * cached by the pool manager.
 */
export class RegistryDbRouter implements TenantDbRouter {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly control: pg.Pool,
    private readonly pools: TenantPoolManager,
    private readonly ttlMs = 60_000,
  ) {}

  async poolFor(tenantId: string): Promise<pg.Pool | undefined> {
    const entry = await this.lookup(tenantId);
    if (entry.model !== "dedicated") return undefined; // Model A → shared appPool
    if (entry.secretRef === null) {
      // A dedicated row with no secret is a corrupt registry entry. Fail loud
      // rather than fall through to the shared pool with this tenant's data.
      throw new Error(`Dedicated tenant ${tenantId} is missing its connection secret`);
    }
    return this.pools.poolFor(tenantId, entry.secretRef);
  }

  private async lookup(tenantId: string): Promise<CacheEntry> {
    const cached = this.cache.get(tenantId);
    const now = Date.now();
    if (cached !== undefined && now - cached.at < this.ttlMs) return cached;

    const { rows } = await this.control.query<{ model: string; database_url_secret_ref: string | null }>(
      "SELECT model, database_url_secret_ref FROM control.tenants WHERE id = $1",
      [tenantId],
    );
    const row = rows[0];
    // An unknown id is treated as shared: the withTenant call will still scope
    // by tenantId under RLS and simply find nothing, which is correct.
    const entry: CacheEntry = {
      model: row?.model ?? "shared",
      secretRef: row?.database_url_secret_ref ?? null,
      at: now,
    };
    this.cache.set(tenantId, entry);
    return entry;
  }
}
