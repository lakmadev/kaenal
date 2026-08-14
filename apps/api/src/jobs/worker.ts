import { config } from "dotenv";
config({ path: new URL("../../../../.env", import.meta.url).pathname });

import pg from "pg";
import IORedis from "ioredis";
import { Queue, Worker, type Job } from "bullmq";
import { S3Client } from "@aws-sdk/client-s3";
import { loadEnv } from "../env.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { InspectionsService } from "../inspections/inspections.service.js";
import { S3Storage } from "../files/s3-storage.js";
import type { Storage } from "../files/storage.js";
import {
  DEFAULT_JOB_OPTS,
  DOCS_SWEEP_CRON,
  FILES_SWEEP_CRON,
  HOUSEKEEPING_SWEEP_CRON,
  JOBS,
  QUEUES,
  SCHEDULE_SWEEP_CRON,
  SLA_SWEEP_CRON,
  type CleanupOrphanedUploadsJob,
  type DocumentExpiryJob,
  type GenerateSummaryJob,
  type MaterializeScheduleJob,
  type PurgeSoftDeletedJob,
  type RecomputeSlaJob,
  type RunExportJob,
  type ScanFileJob,
  type DeliverNotificationJob,
  type SendEmailJob,
} from "./job-types.js";
import { StubScanner } from "./ports.js";
import { createEmailPort } from "../providers/email/index.js";
import { ChannelDelivery } from "../notifications/channel-delivery.js";
import { sendEmail } from "./processors/send-email.js";
import { EnvSecretResolver } from "../tenant/secret-resolver.js";
import { TenantPoolManager } from "../tenant/pool-manager.js";
import { RegistryDbRouter } from "../tenant/db-router.js";
import { recomputeSlaStatesForTenant } from "./processors/sla.js";
import { scanFile } from "./processors/scan-file.js";
import { cleanupOrphanedUploadsForTenant } from "./processors/cleanup-orphaned-uploads.js";
import { deliverNotification } from "./processors/deliver-notification.js";
import { runExport } from "./processors/run-export.js";
import { materializeScheduleForTenant } from "./processors/materialize-schedule.js";
import { documentExpiryCheckForTenant } from "./processors/document-expiry.js";
import { purgeSoftDeletedForTenant } from "./processors/purge-soft-deleted.js";
import { fanOutAuditPartitionRoll, rollAuditPartitions } from "./processors/audit-partition-roll.js";
import { offboardTenants } from "./processors/offboard-tenant.js";
import { generateDocumentSummary } from "./processors/generate-summary.js";
import { AiGatewayService } from "../ai/gateway.service.js";
import { StubAiProvider } from "../ai/provider.js";

/**
 * The worker process (06 §1). Run separately from the API —
 * `pnpm --filter @kaenal/api worker` — so background work never shares the HTTP
 * event loop. Every processor opens a tenant-scoped transaction from the job's
 * `tenantId`, so RLS applies to jobs exactly as it does to requests.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  // BullMQ needs maxRetriesPerRequest: null; one shared connection for all workers.
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const control = new pg.Pool({ connectionString: env.DATABASE_URL, max: 4 });

  // Model B routing (01 §3.1): every per-tenant processor opens its transaction
  // on the pool this router returns for the job's tenantId — the shared appPool
  // for Model A (undefined → withTenant's default), a dedicated pool for Model B.
  const tenantPools = new TenantPoolManager(new EnvSecretResolver(), env.TENANT_MAX_DEDICATED_POOLS);
  const router = new RegistryDbRouter(control, tenantPools);
  const poolFor = (tenantId: string): Promise<pg.Pool | undefined> => router.poolFor(tenantId);

  const notifications = new NotificationsService();
  const inspections = new InspectionsService();
  const scanner = new StubScanner();
  // Email provider is config-selected (EMAIL_PROVIDER); the delivery channel
  // resolves recipients and fans notifications to it. Same port powers the
  // transactional send-email job below.
  const email = createEmailPort(env);
  const delivery = new ChannelDelivery({ email, control });
  // The AI gateway is the ONE model chokepoint (06 §3); the stub provider ships
  // until a real one is wired.
  const aiGateway = new AiGatewayService(new StubAiProvider());
  const storage: Storage = new S3Storage(
    new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: { accessKeyId: env.S3_KEY, secretAccessKey: env.S3_SECRET },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    }),
    env.S3_BUCKET,
    env.S3_URL_TTL_SECONDS,
  );

  const slaQueue = new Queue(QUEUES.sla, { connection });

  const slaWorker = new Worker(
    QUEUES.sla,
    async (job: Job) => {
      if (job.name === JOBS.slaSweep) {
        // Fan out one recompute job per active tenant, so a huge tenant cannot
        // starve the others (06 §1).
        const { rows } = await control.query<{ id: string }>(
          "SELECT id FROM control.tenants WHERE status = 'active'",
        );
        for (const t of rows) {
          await slaQueue.add(JOBS.recomputeSla, { tenantId: t.id } satisfies RecomputeSlaJob, {
            ...DEFAULT_JOB_OPTS,
            jobId: `sla:${t.id}:${slaBucket()}`,
          });
        }
        return;
      }
      if (job.name === JOBS.recomputeSla) {
        const tenantId = (job.data as RecomputeSlaJob).tenantId;
        await recomputeSlaStatesForTenant(tenantId, new Date(), {
          notifications,
          pool: await poolFor(tenantId),
        });
      }
    },
    { connection, concurrency: 4 },
  );

  const filesQueue = new Queue(QUEUES.files, { connection });

  const filesWorker = new Worker(
    QUEUES.files,
    async (job: Job) => {
      if (job.name === JOBS.scanFile) {
        const data = job.data as ScanFileJob;
        await scanFile(data, { scanner, notifications, pool: await poolFor(data.tenantId) });
        return;
      }
      if (job.name === JOBS.filesSweep) {
        // Fan out one orphan-cleanup job per active tenant.
        const { rows } = await control.query<{ id: string }>(
          "SELECT id FROM control.tenants WHERE status = 'active'",
        );
        for (const t of rows) {
          await filesQueue.add(JOBS.cleanupOrphanedUploads, { tenantId: t.id } satisfies CleanupOrphanedUploadsJob, {
            ...DEFAULT_JOB_OPTS,
            jobId: `files-cleanup:${t.id}:${filesBucket()}`,
          });
        }
        return;
      }
      if (job.name === JOBS.cleanupOrphanedUploads) {
        const data = job.data as CleanupOrphanedUploadsJob;
        await cleanupOrphanedUploadsForTenant(data, { storage, pool: await poolFor(data.tenantId) });
      }
    },
    { connection, concurrency: 5 },
  );

  const notifyWorker = new Worker(
    QUEUES.notify,
    async (job: Job) => {
      if (job.name === JOBS.sendEmail) {
        await sendEmail(job.data as SendEmailJob, { email });
        return;
      }
      const data = job.data as DeliverNotificationJob;
      await deliverNotification(data, { delivery, pool: await poolFor(data.tenantId) });
    },
    { connection, concurrency: 10 },
  );

  const reportsWorker = new Worker(
    QUEUES.reports,
    async (job: Job) => {
      const data = job.data as RunExportJob;
      await runExport(data, {
        storage,
        bucket: env.S3_BUCKET,
        notifications,
        pool: await poolFor(data.tenantId),
      });
    },
    { connection, concurrency: 3 },
  );

  const scheduleQueue = new Queue(QUEUES.schedule, { connection });

  const scheduleWorker = new Worker(
    QUEUES.schedule,
    async (job: Job) => {
      if (job.name === JOBS.scheduleSweep) {
        // Same fan-out shape as the SLA sweep: one materialise job per tenant.
        const { rows } = await control.query<{ id: string }>(
          "SELECT id FROM control.tenants WHERE status = 'active'",
        );
        for (const t of rows) {
          await scheduleQueue.add(JOBS.materializeSchedule, { tenantId: t.id } satisfies MaterializeScheduleJob, {
            ...DEFAULT_JOB_OPTS,
            jobId: `schedule:${t.id}:${scheduleBucket()}`,
          });
        }
        return;
      }
      if (job.name === JOBS.materializeSchedule) {
        const data = job.data as MaterializeScheduleJob;
        await materializeScheduleForTenant(data, { inspections, pool: await poolFor(data.tenantId) });
      }
    },
    { connection, concurrency: 4 },
  );

  const docsQueue = new Queue(QUEUES.docs, { connection });

  const docsWorker = new Worker(
    QUEUES.docs,
    async (job: Job) => {
      if (job.name === JOBS.docsSweep) {
        const { rows } = await control.query<{ id: string }>(
          "SELECT id FROM control.tenants WHERE status = 'active'",
        );
        for (const t of rows) {
          await docsQueue.add(JOBS.documentExpiryCheck, { tenantId: t.id } satisfies DocumentExpiryJob, {
            ...DEFAULT_JOB_OPTS,
            jobId: `docs:${t.id}:${docsBucket()}`,
          });
        }
        return;
      }
      if (job.name === JOBS.documentExpiryCheck) {
        const data = job.data as DocumentExpiryJob;
        await documentExpiryCheckForTenant(data, { notifications, pool: await poolFor(data.tenantId) });
      }
    },
    { connection, concurrency: 4 },
  );

  const housekeepingQueue = new Queue(QUEUES.housekeeping, { connection });

  const housekeepingWorker = new Worker(
    QUEUES.housekeeping,
    async (job: Job) => {
      if (job.name === JOBS.housekeepingSweep) {
        const { rows } = await control.query<{ id: string }>(
          "SELECT id FROM control.tenants WHERE status = 'active'",
        );
        for (const t of rows) {
          await housekeepingQueue.add(JOBS.purgeSoftDeleted, { tenantId: t.id } satisfies PurgeSoftDeletedJob, {
            ...DEFAULT_JOB_OPTS,
            jobId: `housekeeping:${t.id}:${housekeepingBucket()}`,
          });
        }
        // The partition roll and tenant offboarding are global (they span all
        // tenants / the control plane), so each is enqueued once per sweep.
        await housekeepingQueue.add(JOBS.auditPartitionRoll, {}, {
          ...DEFAULT_JOB_OPTS,
          jobId: `audit-partition-roll:${housekeepingBucket()}`,
        });
        await housekeepingQueue.add(JOBS.offboardTenant, {}, {
          ...DEFAULT_JOB_OPTS,
          jobId: `offboard-tenant:${housekeepingBucket()}`,
        });
        return;
      }
      if (job.name === JOBS.purgeSoftDeleted) {
        const data = job.data as PurgeSoftDeletedJob;
        await purgeSoftDeletedForTenant(data, { storage, pool: await poolFor(data.tenantId) });
      }
      if (job.name === JOBS.auditPartitionRoll) {
        // The primary run covers the shared/Model A tenants; each dedicated
        // database has its own audit partitions and must be rolled separately.
        await rollAuditPartitions();
        const fan = await fanOutAuditPartitionRoll(control, env.DATABASE_URL);
        if (fan.failures.length > 0) {
          console.error(
            `audit partition roll: ${fan.failures.length} dedicated DB(s) failed: ` +
              fan.failures.map((f) => f.slug).join(", "),
          );
        }
      }
      if (job.name === JOBS.offboardTenant) {
        await offboardTenants({ storage, bucket: env.S3_BUCKET, baseAppUrl: env.DATABASE_APP_URL });
      }
    },
    // Purge is delete-heavy; keep concurrency low so it never contends with
    // request-serving Postgres.
    { connection, concurrency: 2 },
  );

  const aiWorker = new Worker(
    QUEUES.ai,
    (job: Job) => {
      if (job.name === JOBS.generateSummary) {
        const data = job.data as GenerateSummaryJob;
        return poolFor(data.tenantId).then((pool) =>
          generateDocumentSummary(data, { gateway: aiGateway, pool }),
        );
      }
      return Promise.resolve();
    },
    // Model calls are slow and rate-limited upstream; keep concurrency modest.
    { connection, concurrency: 3 },
  );

  // Register the repeatable sweeps once; BullMQ dedupes the schedule by name.
  await slaQueue.add(JOBS.slaSweep, {}, { repeat: { pattern: SLA_SWEEP_CRON }, jobId: "sla-sweep" });
  await filesQueue.add(JOBS.filesSweep, {}, { repeat: { pattern: FILES_SWEEP_CRON }, jobId: "files-sweep" });
  await scheduleQueue.add(JOBS.scheduleSweep, {}, { repeat: { pattern: SCHEDULE_SWEEP_CRON }, jobId: "schedule-sweep" });
  await docsQueue.add(JOBS.docsSweep, {}, { repeat: { pattern: DOCS_SWEEP_CRON }, jobId: "docs-sweep" });
  await housekeepingQueue.add(JOBS.housekeepingSweep, {}, { repeat: { pattern: HOUSEKEEPING_SWEEP_CRON }, jobId: "housekeeping-sweep" });

  const shutdown = async (): Promise<void> => {
    await Promise.allSettled([
      slaWorker.close(),
      filesWorker.close(),
      notifyWorker.close(),
      reportsWorker.close(),
      scheduleWorker.close(),
      docsWorker.close(),
      housekeepingWorker.close(),
      aiWorker.close(),
    ]);
    await slaQueue.close();
    await filesQueue.close();
    await scheduleQueue.close();
    await docsQueue.close();
    await housekeepingQueue.close();
    await connection.quit();
    await tenantPools.closeAll();
    await control.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  console.log("kaenal worker up — queues: sla, files, notify, reports, schedule, docs, housekeeping, ai");
}

/** 5-minute bucket so a retriggered sweep within one window dedupes per tenant. */
function slaBucket(): number {
  return Math.floor(Date.now() / (5 * 60 * 1000));
}

/** 1-day bucket so a retriggered files sweep within the day dedupes per tenant. */
function filesBucket(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
}

/** 1-hour bucket so a retriggered schedule sweep within the hour dedupes per tenant. */
function scheduleBucket(): number {
  return Math.floor(Date.now() / (60 * 60 * 1000));
}

/** 1-day bucket so a retriggered docs sweep within the day dedupes per tenant. */
function docsBucket(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
}

/** 1-day bucket so a retriggered housekeeping sweep within the day dedupes per tenant. */
function housekeepingBucket(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
