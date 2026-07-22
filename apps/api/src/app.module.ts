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
import { AuthService } from "./auth/auth.service.js";
import { SessionAuthenticator } from "./auth/session.authenticator.js";
import { AuthController } from "./auth/auth.controller.js";
import { MeController } from "./me.controller.js";
import { OpenApiController } from "./openapi.controller.js";
import { IdempotencyStore } from "./http/idempotency.js";
import { RateLimiter } from "./http/rate-limit.js";
import { TemplatesController } from "./inspections/templates.controller.js";
import { TemplatesService } from "./inspections/templates.service.js";
import { InspectionsController } from "./inspections/inspections.controller.js";
import { InspectionsService } from "./inspections/inspections.service.js";
import { FindingsController } from "./ncr/findings.controller.js";
import { FindingsService } from "./ncr/findings.service.js";
import { NcrController } from "./ncr/ncr.controller.js";
import { NcrService } from "./ncr/ncr.service.js";
import { CapaController } from "./capa/capa.controller.js";
import { CapaService } from "./capa/capa.service.js";
import { DocumentsController } from "./documents/documents.controller.js";
import { DocumentsService } from "./documents/documents.service.js";
import { FilesController } from "./files/files.controller.js";
import { FilesService } from "./files/files.service.js";
import { S3Storage } from "./files/s3-storage.js";
import { S3Client } from "@aws-sdk/client-s3";
import type { Storage } from "./files/storage.js";
import {
  AUTH_SERVICE,
  AUTHENTICATOR,
  CAPA_SERVICE,
  CONTROL_POOL,
  DOCUMENTS_SERVICE,
  ENV,
  FILES_SERVICE,
  FINDINGS_SERVICE,
  IDEMPOTENCY,
  INSPECTIONS_SERVICE,
  NCR_SERVICE,
  RATE_LIMITER,
  REDIS,
  STORAGE,
  TEMPLATES_SERVICE,
  TENANT_REGISTRY,
} from "./tokens.js";

@Module({
  controllers: [
    HealthController,
    MeController,
    AuthController,
    OpenApiController,
    TemplatesController,
    InspectionsController,
    FindingsController,
    NcrController,
    CapaController,
    DocumentsController,
    FilesController,
  ],
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

    {
      provide: AUTH_SERVICE,
      useFactory: (control: pg.Pool) => new AuthService(control),
      inject: [CONTROL_POOL],
    },

    // The real step 2 (03 §2): resolves the session cookie / bearer token.
    // Tests override AUTHENTICATOR with a stub to drive the rest of the chain.
    {
      provide: AUTHENTICATOR,
      useFactory: (auth: AuthService) => new SessionAuthenticator(auth),
      inject: [AUTH_SERVICE],
    },

    {
      provide: IDEMPOTENCY,
      useFactory: (redis: Redis) => new IdempotencyStore(redis),
      inject: [REDIS],
    },
    { provide: TEMPLATES_SERVICE, useFactory: () => new TemplatesService() },
    { provide: INSPECTIONS_SERVICE, useFactory: () => new InspectionsService() },
    { provide: FINDINGS_SERVICE, useFactory: () => new FindingsService() },
    { provide: NCR_SERVICE, useFactory: () => new NcrService() },
    { provide: CAPA_SERVICE, useFactory: () => new CapaService() },
    { provide: DOCUMENTS_SERVICE, useFactory: () => new DocumentsService() },

    // Object storage (03 §7). One S3 client for the process; MinIO locally.
    {
      provide: STORAGE,
      useFactory: (env: Env): Storage =>
        new S3Storage(
          new S3Client({
            endpoint: env.S3_ENDPOINT,
            region: env.S3_REGION,
            credentials: { accessKeyId: env.S3_KEY, secretAccessKey: env.S3_SECRET },
            forcePathStyle: env.S3_FORCE_PATH_STYLE,
          }),
          env.S3_BUCKET,
          env.S3_URL_TTL_SECONDS,
        ),
      inject: [ENV],
    },
    {
      provide: FILES_SERVICE,
      useFactory: (storage: Storage, env: Env) => new FilesService(storage, env.S3_BUCKET, env.S3_URL_TTL_SECONDS),
      inject: [STORAGE, ENV],
    },
    {
      provide: RATE_LIMITER,
      useFactory: (redis: Redis) => new RateLimiter(redis),
      inject: [REDIS],
    },

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
