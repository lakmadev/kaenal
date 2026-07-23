import type { JobsOptions } from "bullmq";

/**
 * Background job contracts (06 §1). Every payload carries `tenantId` and the
 * processor opens a tenant-scoped transaction with it, so a job is subject to
 * the same RLS as an HTTP request — a job is not a way around tenant isolation.
 */

export const QUEUES = {
  sla: "sla",
  notify: "notify",
  files: "files",
  reports: "reports",
  schedule: "schedule",
  docs: "docs",
  housekeeping: "housekeeping",
  ai: "ai",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const JOBS = {
  /** Repeatable fan-out trigger: enqueues one recompute job per active tenant. */
  slaSweep: "sla.sweep",
  /** Per-tenant SLA recompute + escalation. */
  recomputeSla: "sla.recompute",
  /** AV-scan a completed upload, flip scan_status. */
  scanFile: "files.scan",
  /** Deliver an in-app notification's out-of-band channels (email/push/sms). */
  deliverNotification: "notify.deliver",
  /** Render a requested export server-side and upload it to object storage. */
  runExport: "reports.export",
  /** Repeatable fan-out trigger: enqueues one materialise job per active tenant. */
  scheduleSweep: "schedule.sweep",
  /** Per-tenant: expand recurring inspection series into occurrences. */
  materializeSchedule: "schedule.materialize",
  /** Repeatable fan-out trigger: enqueues one expiry-check job per active tenant. */
  docsSweep: "docs.sweep",
  /** Per-tenant: remind owners of documents nearing their expiry. */
  documentExpiryCheck: "docs.expiry",
  /** Repeatable fan-out trigger: enqueues one purge job per active tenant. */
  housekeepingSweep: "housekeeping.sweep",
  /** Per-tenant: permanently purge rows soft-deleted past the retention window. */
  purgeSoftDeleted: "housekeeping.purge",
  /** Global (not per-tenant): provision upcoming audit partitions + tamper-check counts. */
  auditPartitionRoll: "housekeeping.partition-roll",
  /** Global (not per-tenant): export + purge tenants past their offboarding grace. */
  offboardTenant: "housekeeping.offboard-tenant",
  /** On demand: draft an AI summary for a controlled document, through the gateway. */
  generateSummary: "ai.summary",
} as const;

export interface RecomputeSlaJob {
  readonly tenantId: string;
}
export interface ScanFileJob {
  readonly tenantId: string;
  readonly fileId: string;
}
export interface DeliverNotificationJob {
  readonly tenantId: string;
  readonly notificationId: string;
}
export interface RunExportJob {
  readonly tenantId: string;
  readonly exportId: string;
}
export interface MaterializeScheduleJob {
  readonly tenantId: string;
}
export interface DocumentExpiryJob {
  readonly tenantId: string;
}
export interface PurgeSoftDeletedJob {
  readonly tenantId: string;
}
export interface GenerateSummaryJob {
  readonly tenantId: string;
  readonly userId: string | null;
  readonly documentId: string;
}

/**
 * Job rules (06 §1): 5 attempts, exponential backoff. `removeOnFail: false`
 * keeps exhausted jobs on the failed set as the dead-letter queue for
 * inspection/redelivery; completed jobs are trimmed.
 */
export const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: false,
};

/** How often the SLA sweep runs (06 §1: every 5 minutes). */
export const SLA_SWEEP_CRON = "*/5 * * * *";

/** How often the schedule sweep runs (06 §1: hourly). */
export const SCHEDULE_SWEEP_CRON = "0 * * * *";

/** How often the document-expiry sweep runs (06 §1: daily, early morning). */
export const DOCS_SWEEP_CRON = "0 6 * * *";

/** How often the housekeeping (purge) sweep runs (06 §1: nightly). */
export const HOUSEKEEPING_SWEEP_CRON = "0 3 * * *";
