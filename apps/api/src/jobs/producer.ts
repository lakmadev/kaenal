import { Queue } from "bullmq";
import IORedis from "ioredis";
import {
  DEFAULT_JOB_OPTS,
  JOBS,
  QUEUES,
  type DeliverNotificationJob,
  type RunExportJob,
  type ScanFileJob,
} from "./job-types.js";

/**
 * The enqueue side of the jobs runtime, injected into the services that produce
 * events (Files, Notifications). Behind an interface so the API can run with a
 * `NoopProducer` — nothing enqueued, no Redis connection — whenever jobs are
 * disabled (tests, or a deploy without a worker).
 */
export interface JobProducer {
  scanFile(job: ScanFileJob): Promise<void>;
  deliverNotification(job: DeliverNotificationJob): Promise<void>;
  runExport(job: RunExportJob): Promise<void>;
  close(): Promise<void>;
}

/** Jobs disabled: every enqueue is a no-op. */
export class NoopProducer implements JobProducer {
  scanFile(): Promise<void> {
    return Promise.resolve();
  }
  deliverNotification(): Promise<void> {
    return Promise.resolve();
  }
  runExport(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Real BullMQ producer. The `jobId` on each enqueue is the idempotency key
 * (06 §1): a duplicate enqueue for the same file/notification collapses to one
 * job, so a producer that fires twice cannot double-scan or double-deliver.
 */
export class BullMqProducer implements JobProducer {
  private readonly connection: IORedis;
  private readonly files: Queue;
  private readonly notify: Queue;
  private readonly reports: Queue;

  constructor(redisUrl: string) {
    // BullMQ requires maxRetriesPerRequest: null on its connection.
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.files = new Queue(QUEUES.files, { connection: this.connection });
    this.notify = new Queue(QUEUES.notify, { connection: this.connection });
    this.reports = new Queue(QUEUES.reports, { connection: this.connection });
  }

  async scanFile(job: ScanFileJob): Promise<void> {
    await this.files.add(JOBS.scanFile, job, { ...DEFAULT_JOB_OPTS, jobId: `scan:${job.fileId}` });
  }

  async deliverNotification(job: DeliverNotificationJob): Promise<void> {
    await this.notify.add(JOBS.deliverNotification, job, {
      ...DEFAULT_JOB_OPTS,
      jobId: `deliver:${job.notificationId}`,
    });
  }

  async runExport(job: RunExportJob): Promise<void> {
    // One export id → one render job, so a retried enqueue cannot double-render.
    await this.reports.add(JOBS.runExport, job, { ...DEFAULT_JOB_OPTS, jobId: `export:${job.exportId}` });
  }

  async close(): Promise<void> {
    await this.files.close();
    await this.notify.close();
    await this.reports.close();
    await this.connection.quit();
  }
}
