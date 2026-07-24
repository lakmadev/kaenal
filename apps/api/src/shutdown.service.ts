import { Inject, Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import type Redis from "ioredis";
import type pg from "pg";
import { closePools } from "@kaenal/db";
import type { TenantPoolManager } from "./tenant/pool-manager.js";
import { CONTROL_POOL, REDIS, TENANT_POOLS } from "./tokens.js";

/**
 * Graceful shutdown.
 *
 * Nest tears down providers it constructed, but a `pg.Pool` and an ioredis
 * client created in a factory have no lifecycle hook it recognises, so their
 * sockets stay open and the process never exits — a rolling deploy would then
 * wait out the termination grace period on every replica.
 *
 * `closePools()` covers the app/migrator pools inside @kaenal/db, which are
 * module-level and otherwise owned by nobody. The TenantPoolManager owns any
 * Model B (dedicated) per-tenant pools and closes them the same way.
 */
@Injectable()
export class ShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger("Shutdown");

  constructor(
    @Inject(CONTROL_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(TENANT_POOLS) private readonly tenantPools: TenantPoolManager,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down${signal === undefined ? "" : ` (${signal})`}`);
    await Promise.allSettled([
      this.pool.end(),
      this.redis.quit(),
      closePools(),
      this.tenantPools.closeAll(),
    ]);
  }
}
