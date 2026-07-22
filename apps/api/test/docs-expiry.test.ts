import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { NotificationsService } from "../src/notifications/notifications.service.js";
import { documentExpiryCheckForTenant } from "../src/jobs/processors/document-expiry.js";

/**
 * Document expiry reminders (06 §1 `docs`). The processor is driven directly
 * against real Postgres at a fixed `now`: an approved document 30 days out earns
 * a 30-day reminder, one 5 days out the (more urgent) 7-day one, one 100 days
 * out nothing yet — and a re-run is idempotent, because the notification dedupe
 * key is `(document, threshold)`.
 */

const ACME = "acme";
const NOW = new Date("2026-07-22T00:00:00Z");
const notifications = new NotificationsService();

let control: pg.Pool;
let acmeId = "";
let ownerId = "";

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedOwner(email: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [email, email],
  );
  const userId = rows[0]!.id;
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'manager','active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active'`,
      [acmeId, userId],
    ),
  );
  return userId;
}

/** Seed an approved controlled document expiring `days` from NOW. */
async function seedDoc(title: string, days: number, ownerOverride?: string | null): Promise<string> {
  const id = randomUUID();
  const expiresAt = new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO documents
         (id, tenant_id, code, title, category, status, version, owner_id, expires_at, created_by, updated_by)
       VALUES ($1,$2,$3,$4,'sop','approved','1.0',$5,$6,$5,$5)`,
      [id, acmeId, `DOCEXP-${title}`, `DOCEXPTEST ${title}`, ownerOverride === undefined ? ownerId : ownerOverride, expiresAt],
    ),
  );
  return id;
}

async function notifyCount(docId: string, threshold: number): Promise<number> {
  const { rows } = await control.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM notifications WHERE dedupe_key = $1",
    [`doc-expiry:${docId}:${threshold}`],
  );
  return rows[0]!.n;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  ownerId = await seedOwner("docexp-owner@acme.test");
});

afterAll(async () => {
  await control.query("DELETE FROM notifications WHERE kind = 'document_expiring'");
  await control.query("DELETE FROM documents WHERE title LIKE 'DOCEXPTEST%'");
  await control.query("DELETE FROM memberships WHERE user_id = $1", [ownerId]);
  await control.query("DELETE FROM control.users WHERE email = 'docexp-owner@acme.test'");
  await control.end();
});

describe("document expiry reminders", () => {
  it("reminds at the threshold in effect and skips documents outside the window", async () => {
    const soon = await seedDoc("soon", 30);
    const urgent = await seedDoc("urgent", 5);
    const distant = await seedDoc("distant", 100);

    const { notified } = await documentExpiryCheckForTenant({ tenantId: acmeId }, { notifications, now: NOW });
    expect(notified).toBe(2);

    expect(await notifyCount(soon, 30)).toBe(1);
    expect(await notifyCount(urgent, 7)).toBe(1); // 5 days out → the 7-day notice
    // The distant doc earns no reminder at any threshold.
    expect(await notifyCount(distant, 90)).toBe(0);
    expect(await notifyCount(distant, 30)).toBe(0);
  });

  it("is idempotent — a re-run re-sends nothing", async () => {
    const doc = await seedDoc("repeat", 20);
    await documentExpiryCheckForTenant({ tenantId: acmeId }, { notifications, now: NOW });
    expect(await notifyCount(doc, 30)).toBe(1);

    const { notified } = await documentExpiryCheckForTenant({ tenantId: acmeId }, { notifications, now: NOW });
    // Every reminder already exists → the dedupe key blocks re-insert.
    expect(notified).toBe(0);
    expect(await notifyCount(doc, 30)).toBe(1);
  });

  it("ignores a document with no owner to remind", async () => {
    const orphan = await seedDoc("orphan", 10, null);
    const { notified } = await documentExpiryCheckForTenant({ tenantId: acmeId }, { notifications, now: NOW });
    // The orphan contributes nothing; only the (still-unnotified) nothing here.
    expect(notified).toBe(0);
    expect(await notifyCount(orphan, 7)).toBe(0);
  });
});
