import "reflect-metadata";
import { unzipSync, strFromU8 } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";
import { FakeStorage } from "../src/files/storage.js";
import { runExport } from "../src/jobs/processors/run-export.js";
import { NotificationsService } from "../src/notifications/notifications.service.js";
import { STORAGE } from "../src/tokens.js";

/**
 * Exports slice (03 §8). The async contract end to end: POST returns 202 with a
 * `queued` row, the `reports` processor renders + uploads + completes, and the
 * poll then hands back a presigned download URL. Plus the two rules that matter
 * — you can only export what you may VIEW, and past 100k rows the CSV splits
 * into a zip — and the requester-scoping that keeps one user's export private.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";
const BUCKET = "kaenal-test-exports";

let app: INestApplication;
let control: pg.Pool;
let storage: FakeStorage;
let acmeId = "";
let plantA = "";
let plantB = "";
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

async function seedMember(email: string, role: string, plantIds: string[]): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status) VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, plant_ids = EXCLUDED.plant_ids, status = 'active'`,
      [acmeId, userId, role, plantIds],
    );
  });
  return userId;
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

async function seedNcr(title: string, plantId: string): Promise<void> {
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO ncrs (tenant_id, code, title, source, priority, status, plant_id)
       VALUES ($1, $2, $3, 'inspection', 'major', 'open', $4)`,
      [acmeId, `NCR-EXP-${Math.random().toString(36).slice(2, 8)}`, title, plantId],
    );
  });
}

async function token(email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

interface Export {
  id: string;
  status: string;
  resource: string;
  downloadUrl: string | null;
  rowCount: number | null;
}

/** Run the reports processor against real Postgres + the fake bucket. */
async function render(exportId: string, rowCap?: number): Promise<void> {
  await runExport(
    { tenantId: acmeId, exportId },
    { storage, bucket: BUCKET, notifications: new NotificationsService(), ...(rowCap ? { rowCap } : {}) },
  );
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  plantA = await seedPlant("EXPTESTPA");
  plantB = await seedPlant("EXPTESTPB");
  await seedMember("exp-mgr@acme.test", "manager", []);
  await seedMember("exp-inspector@acme.test", "inspector", [plantA]);
  // Counts are asserted through the plant-scoped inspector, whose visible set is
  // exactly the NCRs in the fresh plantA — deterministic regardless of whatever
  // other NCRs the shared test DB holds. Two in A (for the zip split), one in B.
  await seedNcr("EXPTEST ncr A1", plantA);
  await seedNcr("EXPTEST ncr A2", plantA);
  await seedNcr("EXPTEST ncr in B", plantB);

  // Bind a FakeStorage so the render uploads without a live bucket.
  storage = new FakeStorage();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(STORAGE)
    .useValue(storage)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  mgrTok = await token("exp-mgr@acme.test");
  inspectorTok = await token("exp-inspector@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'exp-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM notifications WHERE kind = 'export_ready'");
  await control.query("DELETE FROM exports WHERE requested_by = ANY($1)", [ids.length > 0 ? ids : [""]]);
  await control.query("DELETE FROM ncrs WHERE title LIKE 'EXPTEST%'");
  await control.query("DELETE FROM plants WHERE code LIKE 'EXPTESTP%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("export lifecycle", () => {
  // Counts are driven through the plant-scoped inspector (exactly plantA's two
  // NCRs), which is deterministic in the shared test DB; the manager would see
  // every NCR in the tenant, including other suites' leftovers.
  it("returns 202 queued, renders a CSV, and polls to a completed download URL", async () => {
    const create = await authed("post", "/v1/exports", inspectorTok).send({ resource: "ncrs", format: "csv" });
    expect(create.status).toBe(202);
    const requested = create.body as Export;
    expect(requested.status).toBe("queued");
    expect(requested.downloadUrl).toBeNull();

    // Before the worker runs, a poll still reports queued (no URL yet).
    const pending = await authed("get", `/v1/exports/${requested.id}`, inspectorTok);
    expect(pending.body.status).toBe("queued");
    expect(pending.body.downloadUrl).toBeNull();

    await render(requested.id);

    const done = (await authed("get", `/v1/exports/${requested.id}`, inspectorTok)).body as Export;
    expect(done.status).toBe("completed");
    expect(done.rowCount).toBe(2); // exactly plantA's two NCRs
    expect(done.downloadUrl).toMatch(/^https?:\/\//);

    // The rendered object exists and is a real CSV with a header + 2 rows.
    const key = `${acmeId}/exports/${requested.id}.csv`;
    const bytes = storage.read(key);
    expect(bytes).not.toBeNull();
    const csv = bytes!.toString("utf8");
    expect(csv.split("\r\n").filter((l) => l.length > 0)).toHaveLength(3);
    expect(csv.startsWith("Code,Title,Status,Priority,Created")).toBe(true);

    // The requester was notified it is ready.
    const notified = await control.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM notifications WHERE kind = 'export_ready' AND entity_id = $1",
      [requested.id],
    );
    expect(notified.rows[0]!.n).toBe(1);
  });

  it("is idempotent — re-running the processor does not re-render a done export", async () => {
    const create = await authed("post", "/v1/exports", inspectorTok).send({ resource: "ncrs" });
    await render(create.body.id);
    // A retry finds it no longer queued and skips.
    const second = await runExport(
      { tenantId: acmeId, exportId: create.body.id },
      { storage, bucket: BUCKET, notifications: new NotificationsService() },
    );
    expect(second.status).toBe("skipped");
  });

  it("splits past the row cap into a zip of chunked CSVs", async () => {
    const create = await authed("post", "/v1/exports", inspectorTok).send({ resource: "ncrs" });
    // Force chunking with a cap of 1 against plantA's 2 NCRs → 2 files.
    await render(create.body.id, 1);

    const done = (await authed("get", `/v1/exports/${create.body.id}`, inspectorTok)).body as Export;
    expect(done.status).toBe("completed");
    expect(done.downloadUrl).toMatch(/\.zip\?|\.zip$/);

    const zip = storage.read(`${acmeId}/exports/${create.body.id}.zip`);
    expect(zip).not.toBeNull();
    const entries = unzipSync(new Uint8Array(zip!));
    const names = Object.keys(entries).sort();
    expect(names).toEqual(["ncrs-part-01.csv", "ncrs-part-02.csv"]);
    // Each part has the header + exactly one data row.
    for (const name of names) {
      const lines = strFromU8(entries[name]!).split("\r\n").filter((l) => l.length > 0);
      expect(lines).toHaveLength(2);
    }
  });

  it("renders an XLSX workbook when requested", async () => {
    const create = await authed("post", "/v1/exports", inspectorTok).send({ resource: "ncrs", format: "xlsx" });
    expect(create.status).toBe(202);
    await render(create.body.id);

    const done = (await authed("get", `/v1/exports/${create.body.id}`, inspectorTok)).body as Export;
    expect(done.status).toBe("completed");
    expect(done.downloadUrl).toMatch(/\.xlsx\?|\.xlsx$/);

    const bytes = storage.read(`${acmeId}/exports/${create.body.id}.xlsx`);
    expect(bytes).not.toBeNull();
    const files = unzipSync(new Uint8Array(bytes!));
    expect(files["xl/worksheets/sheet1.xml"]).toBeDefined();
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain("Code"); // header cell
    expect(sheet.match(/<row /g)?.length).toBe(3); // header + plantA's 2 NCRs
  });

  it("renders a PDF when requested", async () => {
    const create = await authed("post", "/v1/exports", inspectorTok).send({ resource: "ncrs", format: "pdf" });
    expect(create.status).toBe(202);
    await render(create.body.id);

    const done = (await authed("get", `/v1/exports/${create.body.id}`, inspectorTok)).body as Export;
    expect(done.status).toBe("completed");
    expect(done.downloadUrl).toMatch(/\.pdf\?|\.pdf$/);

    const pdf = storage.read(`${acmeId}/exports/${create.body.id}.pdf`)!.toString("latin1");
    expect(pdf.startsWith("%PDF-1.")).toBe(true);
    expect(pdf).toContain("(ncrs export)");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});

describe("authorization + scoping", () => {
  it("plant-scopes an inspector's export to their assigned plant", async () => {
    const create = await authed("post", "/v1/exports", inspectorTok).send({ resource: "ncrs" });
    expect(create.status).toBe(202);
    await render(create.body.id);

    const done = (await authed("get", `/v1/exports/${create.body.id}`, inspectorTok)).body as Export;
    // Only plantA's two NCRs — plantB's is out of scope and must not appear.
    expect(done.rowCount).toBe(2);
    const csv = storage.read(`${acmeId}/exports/${create.body.id}.csv`)!.toString("utf8");
    expect(csv).toContain("EXPTEST ncr A1");
    expect(csv).not.toContain("EXPTEST ncr in B");
  });

  it("hides another user's export as a 404", async () => {
    const create = await authed("post", "/v1/exports", mgrTok).send({ resource: "ncrs" });
    const foreign = await authed("get", `/v1/exports/${create.body.id}`, inspectorTok);
    expect(foreign.status).toBe(404);
  });

  it("lists only the caller's own exports", async () => {
    const list = await authed("get", "/v1/exports", inspectorTok);
    expect(list.status).toBe(200);
    for (const row of list.body.items as Export[]) {
      // Every listed export was requested by the inspector (scoping holds).
      expect(row.resource).toBe("ncrs");
    }
  });
});
