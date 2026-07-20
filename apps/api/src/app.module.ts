import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import Redis from "ioredis";
import pg from "pg";
import { loadEnv, type Env } from "./env.js";
import { ErrorEnvelopeFilter } from "./errors.js";
import { HealthController } from "./health.controller.js";
import { RequestLifecycleInterceptor } from "./lifecycle.interceptor.js";
import { RequestIdMiddleware } from "./request-id.middleware.js";
import { TenantRegistry } from "./tenant/registry.js";
import { ShutdownService } from "./shutdown.service.js";
import { NotImplementedAuthenticator } from "./auth/authenticator.js";
import { MeController } from "./me.controller.js";
import { AUTHENTICATOR, CONTROL_POOL, ENV, REDIS, TENANT_REGISTRY } from "./tokens.js";

@Module({
  controllers: [HealthController, MeController],
  providers: [
    { provide: ENV, useFactory: (): Env => loadEnv() },

    {
      provide: CONTROL_POOL,
      // The registry lives in `control`, which the app role cannot read, so
      // this is the migrator connection string. It is used ONLY for registry
      // lookups and health checks — never to serve tenant data, which always
      // goes through withTenant's RLS-constrained app pool.
      useFactory: (env: Env) => new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 }),
      inject: [ENV],
    },

    {
      provide: REDIS,
      useFactory: (env: Env) => new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 }),
      inject: [ENV],
    },

    {
      provide: TENANT_REGISTRY,
      useFactory: (pool: pg.Pool, redis: Redis, env: Env) =>
        new TenantRegistry(pool, redis, env.TENANT_CACHE_TTL_SECONDS),
      inject: [CONTROL_POOL, REDIS, ENV],
    },

    // Swapped for the real implementation when 03 §2 lands; tests override it
    // to exercise the rest of the lifecycle.
    { provide: AUTHENTICATOR, useClass: NotImplementedAuthenticator },

    ShutdownService,

    { provide: APP_FILTER, useClass: ErrorEnvelopeFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLifecycleInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Ahead of everything, so even a request rejected at tenant resolution
    // carries a correlatable id.
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
