import { Controller, Get, Inject } from "@nestjs/common";
import type Redis from "ioredis";
import type pg from "pg";
import { Public } from "./decorators.js";
import { CONTROL_POOL, REDIS } from "./tokens.js";

/**
 * Health and readiness (03 §9).
 *
 * `/healthz` — is this process alive? No dependency checks: if it failed when
 * Postgres blipped, the orchestrator would kill every replica during a
 * failover and turn a brief database outage into a total one.
 *
 * `/readyz` — should this process receive traffic? Checks DB and Redis, since
 * a replica that cannot reach them serves nothing but errors.
 */
@Controller()
export class HealthController {
  constructor(
    @Inject(CONTROL_POOL) private readonly pool: pg.Pool,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get("healthz")
  health(): { status: "ok" } {
    return { status: "ok" };
  }

  @Public()
  @Get("readyz")
  async ready(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const [db, redis] = await Promise.all([this.check(() => this.pingDb()), this.check(() => this.pingRedis())]);
    const ok = db && redis;
    return { status: ok ? "ready" : "degraded", checks: { db, redis } };
  }

  private async check(fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch {
      return false;
    }
  }

  private async pingDb(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  private async pingRedis(): Promise<void> {
    await this.redis.ping();
  }
}
