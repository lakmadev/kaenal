import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { ApiError } from "../errors.js";
import { REDIS } from "../tokens.js";

/**
 * Sliding-window rate limiting (03 §9).
 *
 * A fixed window lets a caller fire `2 × limit` requests across a window
 * boundary (all at the end of one window, all at the start of the next); a
 * sliding log does not. Each key is a Redis sorted set of request timestamps:
 * evict everything older than the window, add now, count what remains. The four
 * commands run in one pipeline so the count a request sees includes itself and
 * nothing races between the add and the read.
 *
 * Redis, not in-process: the limit has to hold across every API replica, and an
 * in-memory counter per pod is `replicas × limit` in aggregate — no limit at
 * all under load.
 */

export const LOGIN_LIMIT = { limit: 5, windowMs: 60_000 } as const;
export const USER_LIMIT = { limit: 60, windowMs: 60_000 } as const;

export interface RateVerdict {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

@Injectable()
export class RateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateVerdict> {
    const redisKey = `rl:${key}`;
    const cutoff = now - windowMs;
    const member = `${now}-${Math.random().toString(36).slice(2)}`;

    const results = await this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, cutoff)
      .zadd(redisKey, now, member)
      .zcard(redisKey)
      .zrange(redisKey, 0, 0, "WITHSCORES")
      .pexpire(redisKey, windowMs)
      .exec();

    // exec() returns [[err, value], ...] in command order; zcard is index 2.
    const count = Number(results?.[2]?.[1] ?? 0);
    const oldestScore = Number((results?.[3]?.[1] as string[] | undefined)?.[1] ?? now);

    if (count > limit) {
      const retryAfterMs = Math.max(0, oldestScore + windowMs - now);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) || 1 };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
  }

  /** Enforces a limit, throwing the 429 envelope with a Retry-After hint. */
  async enforce(key: string, limit: number, windowMs: number): Promise<void> {
    const verdict = await this.hit(key, limit, windowMs);
    if (!verdict.allowed) {
      throw new ApiError("RATE_LIMITED", "Too many requests — slow down", {
        retryAfterSeconds: verdict.retryAfterSeconds,
      });
    }
  }
}
