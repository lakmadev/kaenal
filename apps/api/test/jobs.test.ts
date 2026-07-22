import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";
import { withTenant } from "@kaenal/db";
import { NotificationsService } from "../src/notifications/notifications.service.js";
import { recomputeSlaStatesForTenant } from "../src/jobs/processors/sla.js";
import { scanFile } from "../src/jobs/processors/scan-file.js";
import { deliverNotification } from "../src/jobs/processors/deliver-notification.js";
import { StubDelivery, StubScanner } from "../src/jobs/ports.js";

/**
 * Jobs runtime (06 §1). The processors are tested directly against real Postgres
 * (each opens its own tenant-scoped transaction), and a final case proves the
 * BullMQ enqueue→process wiring against the test Redis. Jobs stay disabled for
 * the rest of the suite (JOBS_ENABLED off in `test`), so the HTTP app never
 * opens a queue connection — this suite drives the runtime explicitly.
 */

const ACME = "acme";
let control: pg.Pool;
let acmeId = "";
let ownerId = "";
const notifications = new NotificationsService();

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(email: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [email, email],
  );
  const userId = rows[0]!.id;
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'manager','active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active'`,
      [acmeId, userId],
    );
  });
  return userId;
}

async function seedSla(): Promise<void> {
  const bh = JSON.stringify({ days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" });
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO sla_configs (tenant_id, entity_kind, priority, respond_hours, resolve_hours, business_hours)
       VALUES ($1, 'ncr', 'major', 8, 72, $2)
       ON CONFLICT (tenant_id, entity_kind, priority) DO NOTHING`,
      [acmeId, bh],
    ),
  );
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  ownerId = await seedMember("job-owner@acme.test");
  await seedSla();
});

afterAll(async () => {
  await control.query("DELETE FROM notifications WHERE user_id = $1", [ownerId]);
  await control.query("DELETE FROM notification_prefs WHERE user_id = $1", [ownerId]);
  await control.query("DELETE FROM ncrs WHERE title LIKE 'JOBTEST%'");
  await control.query("DELETE FROM files WHERE filename LIKE 'JOBTEST%'");
  await control.query("DELETE FROM memberships WHERE user_id = $1", [ownerId]);
  await control.query("DELETE FROM control.users WHERE id = $1", [ownerId]);
  await control.end();
});

describe("SLA recompute + escalation", () => {
  it("escalates a breached NCR, records it, and notifies the owner", async () => {
    const id = randomUUID();
    await control.query(
      `INSERT INTO ncrs (id, tenant_id, code, title, source, priority, status, owner_id, due_at, sla_state,
                         created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,'JOBTEST breached','manual','major','open',$4,
               now() - interval '10 days','on_track',$4,$4, now() - interval '20 days', now() - interval '20 days')`,
      [id, acmeId, `JOBTEST-${id.slice(0, 8)}`, ownerId],
    );

    const result = await recomputeSlaStatesForTenant(acmeId, new Date(), { notifications });
    expect(result.escalated).toBeGreaterThanOrEqual(1);

    const { rows } = await control.query<{ status: string; sla_state: string }>(
      "SELECT status, sla_state FROM ncrs WHERE id = $1",
      [id],
    );
    expect(rows[0]?.status).toBe("escalated");
    expect(rows[0]?.sla_state).toBe("breached");

    const notif = await control.query(
      "SELECT 1 FROM notifications WHERE user_id = $1 AND kind = 'ncr_escalated' AND entity_id = $2",
      [ownerId, id],
    );
    expect(notif.rows.length).toBe(1);

    // Idempotent: a second sweep leaves the (now escalated) NCR alone.
    const again = await recomputeSlaStatesForTenant(acmeId, new Date(), { notifications });
    const escalatedThisNcr = await control.query(
      "SELECT status FROM ncrs WHERE id = $1",
      [id],
    );
    expect(escalatedThisNcr.rows[0]?.["status"]).toBe("escalated");
    expect(again.escalated).toBe(0);
  });
});

describe("AV scan", () => {
  async function seedFile(filename: string): Promise<string> {
    const id = randomUUID();
    await control.query(
      `INSERT INTO files (id, tenant_id, bucket, key, filename, mime, size_bytes, scan_status, uploaded_by, created_by, updated_by)
       VALUES ($1,$2,'b',$3,$4,'application/pdf',100,'pending',$5,$5,$5)`,
      [id, acmeId, `k/${id}`, filename, ownerId],
    );
    return id;
  }

  it("marks a clean file clean", async () => {
    const id = await seedFile("JOBTEST-clean.pdf");
    const res = await scanFile({ tenantId: acmeId, fileId: id }, { scanner: new StubScanner(), notifications });
    expect(res.status).toBe("clean");
    const { rows } = await control.query("SELECT scan_status FROM files WHERE id = $1", [id]);
    expect(rows[0]?.["scan_status"]).toBe("clean");
  });

  it("quarantines an infected file and notifies the uploader", async () => {
    const id = await seedFile("JOBTEST-eicar.pdf");
    const res = await scanFile({ tenantId: acmeId, fileId: id }, { scanner: new StubScanner(), notifications });
    expect(res.status).toBe("infected");

    const notif = await control.query(
      "SELECT 1 FROM notifications WHERE user_id = $1 AND kind = 'file_infected' AND entity_id = $2",
      [ownerId, id],
    );
    expect(notif.rows.length).toBe(1);
  });

  it("is idempotent — a re-scan does not re-flip", async () => {
    const id = await seedFile("JOBTEST-clean2.pdf");
    await scanFile({ tenantId: acmeId, fileId: id }, { scanner: new StubScanner(), notifications });
    await control.query("UPDATE files SET scan_status = 'infected' WHERE id = $1", [id]); // simulate a later manual change
    const res = await scanFile({ tenantId: acmeId, fileId: id }, { scanner: new StubScanner(), notifications });
    expect(res.status).toBe("infected"); // skipped, not re-scanned back to clean
  });
});

describe("notification delivery", () => {
  it("delivers only the channels the user opted into, and records them", async () => {
    const created = await withTenant(acmeId, null, (tx) =>
      notifications.notify(tx, acmeId, { userId: ownerId, kind: "jobtest_deliver", title: "JOBTEST deliver" }),
    );
    const notificationId = created!.id;

    await control.query(
      `INSERT INTO notification_prefs (tenant_id, user_id, matrix) VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET matrix = EXCLUDED.matrix`,
      [acmeId, ownerId, JSON.stringify({ jobtest_deliver: { inapp: true, email: true, push: false, sms: false } })],
    );

    const res = await deliverNotification(
      { tenantId: acmeId, notificationId },
      { delivery: new StubDelivery() },
    );
    expect(res.channels).toEqual(["email"]); // push/sms opted out

    const { rows } = await control.query<{ channels_sent: string[] }>(
      "SELECT channels_sent FROM notifications WHERE id = $1",
      [notificationId],
    );
    expect(rows[0]?.channels_sent).toContain("email");

    // Idempotent: re-running delivers nothing new.
    const rerun = await deliverNotification({ tenantId: acmeId, notificationId }, { delivery: new StubDelivery() });
    expect(rerun.channels).toEqual([]);
  });
});

describe("BullMQ wiring", () => {
  it("processes an enqueued job end to end", async () => {
    const connection = new IORedis(process.env["REDIS_URL"] ?? "redis://localhost:6380", {
      maxRetriesPerRequest: null,
    });
    const queueName = `jobtest-rt-${randomUUID().slice(0, 8)}`;
    const queue = new Queue(queueName, { connection });

    let processed: string | null = null;
    const done = new Promise<void>((resolve) => {
      const worker = new Worker(
        queueName,
        (job) => {
          processed = (job.data as { ping: string }).ping;
          return Promise.resolve();
        },
        { connection },
      );
      worker.on("completed", () => {
        void worker.close().then(resolve);
      });
    });

    await queue.add("ping", { ping: "pong" });
    await done;
    expect(processed).toBe("pong");

    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
  });
});
