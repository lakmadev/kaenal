import pg from "pg";
import { Logger } from "@nestjs/common";
import type { SecretResolver } from "./secret-resolver.js";

/**
 * Per-tenant connection pools for Model B (dedicated Postgres per tenant,
 * 01 §3.1 / §3.3 step 3).
 *
 * Model A tenants all share `@kaenal/db`'s `appPool`; Model B tenants each have
 * their own database, so each needs its own pool. Holding an unbounded number
 * of pools would exhaust file descriptors and each database's own connection
 * budget, so the manager is an LRU capped at `maxPools` (~20, 01 §3.3): the
 * least-recently-used tenant's pool is closed when a new one pushes past the cap.
 *
 * Pools are keyed by tenant id and created lazily on first request. Creation is
 * memoised as a *promise* so two concurrent first-requests for the same tenant
 * share one pool rather than racing to open two (and leaking one).
 */
const DEFAULT_MAX_POOLS = 20;
const PER_TENANT_POOL_MAX = 10;

export class TenantPoolManager {
  private readonly logger = new Logger("TenantPools");
  // Insertion order is the LRU order: least-recently-used first. A cache hit
  // deletes + re-inserts to move the entry to the most-recent (last) position.
  private readonly pools = new Map<string, Promise<pg.Pool>>();

  constructor(
    private readonly secrets: SecretResolver,
    private readonly maxPools: number = DEFAULT_MAX_POOLS,
  ) {}

  /**
   * The pool for a dedicated tenant, resolving its connection string via the
   * secret ref on first use. Throws (never returns a shared/foreign pool) if
   * the secret is missing or malformed — the caller must fail the request.
   */
  async poolFor(tenantId: string, secretRef: string): Promise<pg.Pool> {
    const existing = this.pools.get(tenantId);
    if (existing !== undefined) {
      this.touch(tenantId, existing);
      return existing;
    }

    const created = this.open(secretRef);
    this.pools.set(tenantId, created);
    // Eviction runs after insert so a fresh entry is never the one evicted.
    await this.evictDownToCap();

    try {
      return await created;
    } catch (err) {
      // A failed open must not stick in the cache as a permanently-rejected
      // promise; drop it so the next request retries.
      if (this.pools.get(tenantId) === created) this.pools.delete(tenantId);
      throw err;
    }
  }

  private async open(secretRef: string): Promise<pg.Pool> {
    const connectionString = await this.secrets.resolve(secretRef);
    return new pg.Pool({ connectionString, max: PER_TENANT_POOL_MAX });
  }

  private touch(tenantId: string, entry: Promise<pg.Pool>): void {
    this.pools.delete(tenantId);
    this.pools.set(tenantId, entry);
  }

  private async evictDownToCap(): Promise<void> {
    while (this.pools.size > this.maxPools) {
      const oldest = this.pools.keys().next().value as string;
      const evicted = this.pools.get(oldest);
      this.pools.delete(oldest);
      if (evicted !== undefined) await this.endQuietly(oldest, evicted);
    }
  }

  private async endQuietly(tenantId: string, entry: Promise<pg.Pool>): Promise<void> {
    try {
      await (await entry).end();
    } catch (err) {
      // A pool that failed to open, or errors on close, must not stop eviction
      // or shutdown — the goal is to release the slot, best-effort.
      this.logger.warn(`Closing dedicated pool for ${tenantId} failed: ${String(err)}`);
    }
  }

  /** How many dedicated pools are currently held (for tests / metrics). */
  get size(): number {
    return this.pools.size;
  }

  /** Graceful shutdown: close every dedicated pool. */
  async closeAll(): Promise<void> {
    const entries = [...this.pools.entries()];
    this.pools.clear();
    await Promise.all(entries.map(([id, entry]) => this.endQuietly(id, entry)));
  }
}
