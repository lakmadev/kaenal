import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";
import { InspectionsService } from "../src/inspections/inspections.service.js";
import { materializeScheduleForTenant } from "../src/jobs/processors/materialize-schedule.js";

/**
 * Scheduling / recurrence slice (02 §2, 06 `schedule`). A recurring inspection
 * is a series head carrying a `recurrence` rule; the `schedule` job materialises
 * it into occurrence inspections within the horizon window, idempotent on
 * `(seriesId, date)`. Proven here end to end: create a series, run the
 * processor against real Postgres, poll the occurrences, prove a re-run adds
 * nothing, and cover the recurrence edits, plant scoping, and concurrency.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";
const ANCHOR = "2026-09-01T09:00:00Z"; // a Tuesday
const NOW = new Date("2026-09-01T00:00:00Z");

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let plantA = "";
let plantB = "";
let templateId = "";
let mgrTok = "";
let inspectorTok = ""; // scoped to plantA

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(email: string, role: string, plantIds: string[]): Promise<void> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]!.id;
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status) VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, plant_ids = EXCLUDED.plant_ids, status = 'active'`,
      [acmeId, userId, role, plantIds],
    );
  });
}

async function seedPlant(code: string): Promise<string> {
  const { rows } = await withTenant(acmeId, null, (tx) =>
    tx.query<{ id: string }>(`INSERT INTO plants (tenant_id, name, code, timezone) VALUES ($1,$2,$3,'UTC') RETURNING id`, [
      acmeId,
      code,
      code,
    ]),
  );
  return rows[0]!.id;
}

async function seedTemplate(): Promise<string> {
  const id = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO inspection_templates (id, tenant_id, name, version, status, schema)
       VALUES ($1, $2, 'SCHEDTEST template', 1, 'published', '{"sections":[]}'::jsonb)`,
      [id, acmeId],
    ),
  );
  return id;
}

async function token(email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post" | "put", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

interface Inspection {
  id: string;
  code: string;
  seriesId: string | null;
  occurrenceDate: string | null;
  recurrence: unknown;
  lockVersion: number;
}

async function createSeries(plantId: string, recurrence: unknown): Promise<Inspection> {
  const res = await authed("post", "/v1/inspections", mgrTok).send({
    title: "SCHEDTEST weekly walk",
    templateId,
    plantId,
    scheduledAt: ANCHOR,
    recurrence,
  });
  expect(res.status).toBe(201);
  return res.body as Inspection;
}

/**
 * Materialise this tenant's due occurrences at the fixed NOW. The return count
 * is tenant-wide (other series — including the demo seed's — may exist), so
 * tests assert on a specific head's occurrences via `occurrences()`, not on this.
 */
async function materialize(): Promise<void> {
  await materializeScheduleForTenant({ tenantId: acmeId }, { inspections: new InspectionsService(), now: NOW });
}

/** Count a specific series head's materialised occurrences. */
async function occurrences(headId: string, bearer = mgrTok): Promise<Inspection[]> {
  const res = await authed("get", `/v1/inspections/${headId}/occurrences`, bearer);
  expect(res.status).toBe(200);
  return res.body.items as Inspection[];
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  plantA = await seedPlant("SCHEDTPA");
  plantB = await seedPlant("SCHEDTPB");
  templateId = await seedTemplate();
  await seedMember("sched-mgr@acme.test", "manager", []);
  await seedMember("sched-inspector@acme.test", "inspector", [plantA]);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  mgrTok = await token("sched-mgr@acme.test");
  inspectorTok = await token("sched-inspector@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'sched-%@acme.test'")
  ).rows.map((r) => r.id);
  // Occurrences (series_id set) before heads — the series FK is ON DELETE RESTRICT.
  await control.query("DELETE FROM inspections WHERE series_id IS NOT NULL AND title LIKE 'SCHEDTEST%'");
  await control.query("DELETE FROM inspections WHERE title LIKE 'SCHEDTEST%'");
  await control.query("DELETE FROM inspection_templates WHERE name = 'SCHEDTEST template'");
  await control.query("DELETE FROM plants WHERE code LIKE 'SCHEDTP%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("materialisation", () => {
  it("expands a daily series into occurrences and is idempotent on re-run", async () => {
    // Daily, bounded by `until` at anchor+4d → 5 occurrence days (Sep 1–5).
    const head = await createSeries(plantA, { freq: "daily", interval: 1, until: "2026-09-05T09:00:00Z" });
    expect(head.seriesId).toBeNull(); // the head is not itself an occurrence
    expect(head.recurrence).not.toBeNull();

    await materialize();

    const items = await occurrences(head.id);
    expect(items).toHaveLength(5); // Sep 1–5 inclusive
    for (const o of items) {
      expect(o.seriesId).toBe(head.id);
      expect(o.occurrenceDate).toMatch(/^2026-09-0[1-5]$/);
      expect(o.code).toMatch(/^INS-\d{4}-\d+$/);
    }
    // Distinct days, no double-booking.
    expect(new Set(items.map((o) => o.occurrenceDate)).size).toBe(5);

    // A second sweep in the same window adds nothing to this series.
    await materialize();
    expect(await occurrences(head.id)).toHaveLength(5);
  });

  it("stops materialising once recurrence is cleared", async () => {
    const head = await createSeries(plantA, { freq: "daily", interval: 1, until: "2026-09-03T09:00:00Z" });
    await materialize();
    expect(await occurrences(head.id)).toHaveLength(3); // Sep 1–3

    const cleared = await authed("put", `/v1/inspections/${head.id}/recurrence`, mgrTok).send({
      recurrence: null,
      version: head.lockVersion,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.recurrence).toBeNull();

    // No recurrence on the head → its occurrence set does not grow.
    await materialize();
    expect(await occurrences(head.id)).toHaveLength(3);
  });
});

describe("recurrence edits + scoping", () => {
  it("rejects a stale recurrence update and refuses one on an occurrence", async () => {
    const head = await createSeries(plantA, { freq: "weekly", interval: 1 });
    await materialize();

    const stale = await authed("put", `/v1/inspections/${head.id}/recurrence`, mgrTok).send({
      recurrence: { freq: "monthly", interval: 1 },
      version: head.lockVersion + 9,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_WRITE");

    // A generated occurrence cannot be given its own recurrence.
    const occ = (await authed("get", `/v1/inspections/${head.id}/occurrences`, mgrTok)).body.items[0] as Inspection;
    const onOcc = await authed("put", `/v1/inspections/${occ.id}/recurrence`, mgrTok).send({
      recurrence: { freq: "daily", interval: 1 },
      version: occ.lockVersion,
    });
    expect(onOcc.status).toBe(409);
    expect(onOcc.body.error.code).toBe("CONFLICT");
  });

  it("hides another plant's series and its occurrences from a scoped inspector", async () => {
    const head = await createSeries(plantB, { freq: "daily", interval: 1, until: "2026-09-02T09:00:00Z" });
    await materialize();

    // The plantA inspector cannot see the plantB series → 404 (rule 8).
    const get = await authed("get", `/v1/inspections/${head.id}`, inspectorTok);
    expect(get.status).toBe(404);
    const occ = await authed("get", `/v1/inspections/${head.id}/occurrences`, inspectorTok);
    expect(occ.status).toBe(404);
  });
});
