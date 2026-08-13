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
import { TenantPoolManager } from "./tenant/pool-manager.js";
import { EnvSecretResolver, type SecretResolver } from "./tenant/secret-resolver.js";
import { ShutdownService } from "./shutdown.service.js";
import { AuthService } from "./auth/auth.service.js";
import { SessionAuthenticator } from "./auth/session.authenticator.js";
import { AuthController } from "./auth/auth.controller.js";
import { WorkspaceController } from "./auth/workspace.controller.js";
import { MeController } from "./me.controller.js";
import { MembersController } from "./members/members.controller.js";
import { MembersService } from "./members/members.service.js";
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
import { EightDController } from "./eight-d/eight-d.controller.js";
import { EightDService } from "./eight-d/eight-d.service.js";
import { AuditsController } from "./audits/audits.controller.js";
import { AuditsService } from "./audits/audits.service.js";
import { DocumentsController } from "./documents/documents.controller.js";
import { DocumentsService } from "./documents/documents.service.js";
import { SuppliersController } from "./suppliers/suppliers.controller.js";
import { SuppliersService } from "./suppliers/suppliers.service.js";
import { PpapController } from "./ppap/ppap.controller.js";
import { PpapService } from "./ppap/ppap.service.js";
import { ScarController } from "./scar/scar.controller.js";
import { ScarService } from "./scar/scar.service.js";
import { PortalController } from "./portal/portal.controller.js";
import { PortalService } from "./portal/portal.service.js";
import { FilesController } from "./files/files.controller.js";
import { FilesService } from "./files/files.service.js";
import { ExportsController } from "./exports/exports.controller.js";
import { ExportsService } from "./exports/exports.service.js";
import { AiController } from "./ai/ai.controller.js";
import { AiService } from "./ai/ai.service.js";
import { AiGatewayService } from "./ai/gateway.service.js";
import { StubAiProvider } from "./ai/provider.js";
import { S3Storage } from "./files/s3-storage.js";
import { S3Client } from "@aws-sdk/client-s3";
import type { Storage } from "./files/storage.js";
import { SearchController } from "./search/search.controller.js";
import { SearchService } from "./search/search.service.js";
import { NotificationsController } from "./notifications/notifications.controller.js";
import { NotificationsService } from "./notifications/notifications.service.js";
import { CommentsController } from "./collab/comments.controller.js";
import { CommentsService } from "./collab/comments.service.js";
import { AuditLogController } from "./collab/audit-log.controller.js";
import { AuditLogService } from "./collab/audit-log.service.js";
import { EntityLinksController } from "./collab/entity-links.controller.js";
import { EntityLinksService } from "./collab/entity-links.service.js";
import { SettingsController } from "./settings/settings.controller.js";
import { SettingsService } from "./settings/settings.service.js";
import { NcrRulesService } from "./settings/ncr-rules.service.js";
import { LegalHoldsService } from "./settings/legal-holds.service.js";
import { DlpPoliciesService } from "./settings/dlp-policies.service.js";
import { CostCentersService } from "./settings/cost-centers.service.js";
import { FmeaController } from "./fmea/fmea.controller.js";
import { FmeaService } from "./fmea/fmea.service.js";
import { QueryController } from "./query/query.controller.js";
import { QueryService } from "./query/query.service.js";
import { ReportsController } from "./reports/reports.controller.js";
import { ReportsService } from "./reports/reports.service.js";
import { IntegrationsController } from "./integrations/integrations.controller.js";
import { IntegrationsService } from "./integrations/integrations.service.js";
import { ImportController } from "./import/import.controller.js";
import { ImportService } from "./import/import.service.js";
import { SpcController } from "./spc/spc.controller.js";
import { SpcService } from "./spc/spc.service.js";
import { BullMqProducer, NoopProducer, type JobProducer } from "./jobs/producer.js";
import {
  AI_GATEWAY,
  AI_SERVICE,
  SECRET_RESOLVER,
  TENANT_POOLS,
  AUDITS_SERVICE,
  AUDIT_LOG_SERVICE,
  AUTH_SERVICE,
  AUTHENTICATOR,
  CAPA_SERVICE,
  COMMENTS_SERVICE,
  CONTROL_POOL,
  ENTITY_LINKS_SERVICE,
  DOCUMENTS_SERVICE,
  SUPPLIERS_SERVICE,
  PPAP_SERVICE,
  SCAR_SERVICE,
  PORTAL_SERVICE,
  EIGHT_D_SERVICE,
  ENV,
  EXPORTS_SERVICE,
  FILES_SERVICE,
  FINDINGS_SERVICE,
  IDEMPOTENCY,
  INSPECTIONS_SERVICE,
  JOB_PRODUCER,
  MEMBERS_SERVICE,
  NCR_SERVICE,
  NOTIFICATIONS_SERVICE,
  RATE_LIMITER,
  REDIS,
  SEARCH_SERVICE,
  SETTINGS_SERVICE,
  NCR_RULES_SERVICE,
  LEGAL_HOLDS_SERVICE,
  DLP_POLICIES_SERVICE,
  COST_CENTERS_SERVICE,
  FMEA_SERVICE,
  QUERY_SERVICE,
  REPORTS_SERVICE,
  INTEGRATIONS_SERVICE,
  IMPORT_SERVICE,
  SPC_SERVICE,
  STORAGE,
  TEMPLATES_SERVICE,
  TENANT_REGISTRY,
} from "./tokens.js";

@Module({
  controllers: [
    HealthController,
    MeController,
    MembersController,
    AuthController,
    WorkspaceController,
    OpenApiController,
    TemplatesController,
    InspectionsController,
    FindingsController,
    NcrController,
    CapaController,
    EightDController,
    AuditsController,
    DocumentsController,
    SuppliersController,
    PpapController,
    ScarController,
    PortalController,
    FilesController,
    ExportsController,
    AiController,
    SearchController,
    NotificationsController,
    CommentsController,
    AuditLogController,
    EntityLinksController,
    SettingsController,
    FmeaController,
    QueryController,
    ReportsController,
    IntegrationsController,
    ImportController,
    SpcController,
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

    // Model B routing (01 §3.1): resolves a dedicated tenant's connection
    // secret and holds an LRU-capped pool per tenant. The resolver reads the
    // ref's target (env var locally); a cloud secrets-manager resolver drops in
    // behind the same interface. Model A never touches either.
    { provide: SECRET_RESOLVER, useFactory: (): SecretResolver => new EnvSecretResolver() },
    {
      provide: TENANT_POOLS,
      useFactory: (secrets: SecretResolver, env: Env) =>
        new TenantPoolManager(secrets, env.TENANT_MAX_DEDICATED_POOLS),
      inject: [SECRET_RESOLVER, ENV],
    },

    {
      provide: AUTH_SERVICE,
      useFactory: (control: pg.Pool) => new AuthService(control),
      inject: [CONTROL_POOL],
    },

    // Names live in `control.users` (outside RLS), the roster in `memberships`
    // (RLS): the directory service needs the control pool for the former.
    {
      provide: MEMBERS_SERVICE,
      useFactory: (control: pg.Pool) => new MembersService(control),
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
    {
      provide: INSPECTIONS_SERVICE,
      useFactory: (n: NotificationsService) => new InspectionsService(n),
      inject: [NOTIFICATIONS_SERVICE],
    },
    { provide: FINDINGS_SERVICE, useFactory: () => new FindingsService() },
    {
      provide: NCR_SERVICE,
      useFactory: (n: NotificationsService) => new NcrService(n),
      inject: [NOTIFICATIONS_SERVICE],
    },
    { provide: CAPA_SERVICE, useFactory: () => new CapaService() },
    {
      provide: EIGHT_D_SERVICE,
      useFactory: (n: NotificationsService) => new EightDService(n),
      inject: [NOTIFICATIONS_SERVICE],
    },
    {
      provide: AUDITS_SERVICE,
      useFactory: (ncrs: NcrService, capas: CapaService) => new AuditsService(ncrs, capas),
      inject: [NCR_SERVICE, CAPA_SERVICE],
    },
    { provide: DOCUMENTS_SERVICE, useFactory: () => new DocumentsService() },
    { provide: SUPPLIERS_SERVICE, useFactory: () => new SuppliersService() },
    { provide: PPAP_SERVICE, useFactory: () => new PpapService() },
    {
      provide: SCAR_SERVICE,
      useFactory: (n: NotificationsService) => new ScarService(n),
      inject: [NOTIFICATIONS_SERVICE],
    },
    {
      provide: PORTAL_SERVICE,
      useFactory: (scar: ScarService, ppap: PpapService, files: FilesService) =>
        new PortalService(scar, ppap, files),
      inject: [SCAR_SERVICE, PPAP_SERVICE, FILES_SERVICE],
    },

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
      useFactory: (storage: Storage, env: Env, jobs: JobProducer) =>
        new FilesService(storage, env.S3_BUCKET, env.S3_URL_TTL_SECONDS, jobs),
      inject: [STORAGE, ENV, JOB_PRODUCER],
    },
    {
      provide: EXPORTS_SERVICE,
      useFactory: (storage: Storage, jobs: JobProducer) => new ExportsService(storage, jobs),
      inject: [STORAGE, JOB_PRODUCER],
    },
    // The AI gateway is the one model chokepoint (06 §3); the stub provider ships
    // until a real one is wired.
    { provide: AI_GATEWAY, useFactory: () => new AiGatewayService(new StubAiProvider()) },
    {
      provide: AI_SERVICE,
      useFactory: (gateway: AiGatewayService) => new AiService(gateway),
      inject: [AI_GATEWAY],
    },
    { provide: SEARCH_SERVICE, useFactory: () => new SearchService() },

    // Job producer: real BullMQ queues when jobs are enabled, else a no-op that
    // opens no Redis connection (default in tests). The worker process consumes.
    {
      provide: JOB_PRODUCER,
      useFactory: (env: Env): JobProducer =>
        env.JOBS_ENABLED ? new BullMqProducer(env.REDIS_URL) : new NoopProducer(),
      inject: [ENV],
    },
    {
      provide: NOTIFICATIONS_SERVICE,
      useFactory: (jobs: JobProducer) => new NotificationsService(jobs),
      inject: [JOB_PRODUCER],
    },
    { provide: COMMENTS_SERVICE, useFactory: () => new CommentsService() },
    { provide: AUDIT_LOG_SERVICE, useFactory: () => new AuditLogService() },
    { provide: ENTITY_LINKS_SERVICE, useFactory: () => new EntityLinksService() },
    { provide: SETTINGS_SERVICE, useFactory: () => new SettingsService() },
    { provide: NCR_RULES_SERVICE, useFactory: () => new NcrRulesService() },
    { provide: LEGAL_HOLDS_SERVICE, useFactory: () => new LegalHoldsService() },
    { provide: DLP_POLICIES_SERVICE, useFactory: () => new DlpPoliciesService() },
    {
      provide: COST_CENTERS_SERVICE,
      useFactory: (control: pg.Pool) => new CostCentersService(control),
      inject: [CONTROL_POOL],
    },
    { provide: FMEA_SERVICE, useFactory: () => new FmeaService() },
    { provide: QUERY_SERVICE, useFactory: () => new QueryService() },
    { provide: REPORTS_SERVICE, useFactory: () => new ReportsService() },
    { provide: INTEGRATIONS_SERVICE, useFactory: () => new IntegrationsService() },
    { provide: IMPORT_SERVICE, useFactory: () => new ImportService() },
    { provide: SPC_SERVICE, useFactory: () => new SpcService() },
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
