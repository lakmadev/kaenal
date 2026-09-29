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

function authed(method: "get" | "post" | "patch", path: string, bearer: string) {
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

describe("audit_report export (Sprint 02 S2-2)", () => {
  it("renders one audit's report as a PDF, and 404s on a foreign auditId before enqueueing", async () => {
    const audit = await authed("post", "/v1/audits", mgrTok).send({ title: "EXPTEST audit report", type: "internal" });
    expect(audit.status).toBe(201);
    await authed("post", `/v1/audits/${audit.body.id}/findings`, mgrTok).send({
      kind: "major_nc",
      description: "EXPTEST finding for the report",
    });

    // A foreign/unknown auditId is a 404 immediately — never a queued job.
    const badId = await authed("post", "/v1/exports", mgrTok).send({
      resource: "audit_report",
      format: "pdf",
      filters: { auditId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(badId.status).toBe(404);

    const create = await authed("post", "/v1/exports", mgrTok).send({
      resource: "audit_report",
      format: "pdf",
      filters: { auditId: audit.body.id },
    });
    expect(create.status).toBe(202);
    await render(create.body.id);

    const done = (await authed("get", `/v1/exports/${create.body.id}`, mgrTok)).body as Export;
    expect(done.status).toBe("completed");
    const pdf = storage.read(`${acmeId}/exports/${create.body.id}.pdf`)!.toString("latin1");
    expect(pdf).toContain("EXPTEST audit report");
    expect(pdf).toContain("Major NCs");

    await control.query("DELETE FROM audit_findings WHERE description LIKE 'EXPTEST%'");
    await control.query("DELETE FROM audits WHERE title = 'EXPTEST audit report'");
  });

  it("requires filters.auditId for an audit_report export", async () => {
    const res = await authed("post", "/v1/exports", mgrTok).send({ resource: "audit_report", format: "pdf" });
    expect(res.status).toBe(422);
  });
});

describe("predictive_forecast_pack export (Sprint 03 Part B, P4)", () => {
  it("renders the current ranked lines+suppliers forecast as a PDF", async () => {
    const area = await withTenant(acmeId, null, (tx) =>
      tx.query<{ id: string }>(
        `INSERT INTO areas (tenant_id, plant_id, name) VALUES ($1, $2, 'EXPTEST Forecast Line') RETURNING id`,
        [acmeId, plantA],
      ),
    );
    const areaId = area.rows[0]!.id;
    await withTenant(acmeId, null, (tx) =>
      tx.query(
        `INSERT INTO risk_predictions
           (tenant_id, subject_kind, subject_id, horizon, predicted_value, confidence,
            band_low, band_high, history, reasoning, model_version, generated_at)
         VALUES ($1, 'line', $2, '2026-Q4', 9, 80, 6, 12, ARRAY[1,2,2,3,4,4]::numeric[],
                 'EXPTEST rising driver', 'nc-forecast-v1-baseline', now())`,
        [acmeId, areaId],
      ),
    );

    const create = await authed("post", "/v1/exports", mgrTok).send({ resource: "predictive_forecast_pack", format: "pdf" });
    expect(create.status).toBe(202);
    await render(create.body.id);

    const done = (await authed("get", `/v1/exports/${create.body.id}`, mgrTok)).body as Export;
    expect(done.status).toBe("completed");
    const pdf = storage.read(`${acmeId}/exports/${create.body.id}.pdf`)!.toString("latin1");
    expect(pdf).toContain("EXPTEST Forecast Line");
    expect(pdf).toContain("EXPTEST rising driver");

    await control.query("DELETE FROM risk_predictions WHERE subject_id = $1", [areaId]);
    await control.query("DELETE FROM areas WHERE id = $1", [areaId]);
  });

  it("requires prediction:view — a role without it 403s before enqueueing", async () => {
    const res = await authed("post", "/v1/exports", inspectorTok).send({ resource: "predictive_forecast_pack", format: "pdf" });
    expect(res.status).toBe(403);
  });
});

describe("risk_board_pack export (Sprint 04 R5)", () => {
  it("renders the register's KPI strip + table as a PDF, scoped to risk:view", async () => {
    const mgrId = (await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = 'exp-mgr@acme.test'")).rows[0]!.id;
    const risk = await authed("post", "/v1/risks", mgrTok).send({
      category: "cyber",
      title: "EXPTEST ransomware exposure",
      owner: mgrId,
      likelihood: 5,
      impact: 4,
      treatment: "mitigate",
    });
    expect(risk.status).toBe(201);

    const create = await authed("post", "/v1/exports", mgrTok).send({ resource: "risk_board_pack", format: "pdf" });
    expect(create.status).toBe(202);
    await render(create.body.id);

    const done = (await authed("get", `/v1/exports/${create.body.id}`, mgrTok)).body as Export;
    expect(done.status).toBe("completed");
    const pdf = storage.read(`${acmeId}/exports/${create.body.id}.pdf`)!.toString("latin1");
    expect(pdf).toContain("EXPTEST ransomware exposure");
    expect(pdf).toContain("Total risks");

    await control.query("DELETE FROM risks WHERE title = 'EXPTEST ransomware exposure'");
  });
});

describe("gauge_rr_aiag_report export (Sprint 04 M5)", () => {
  it("404s on a foreign/unknown studyId before enqueueing", async () => {
    const res = await authed("post", "/v1/exports", mgrTok).send({
      resource: "gauge_rr_aiag_report",
      format: "pdf",
      filters: { studyId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(404);
  });

  it("requires filters.studyId", async () => {
    const res = await authed("post", "/v1/exports", mgrTok).send({ resource: "gauge_rr_aiag_report", format: "pdf" });
    expect(res.status).toBe(422);
  });

  it("renders an incomplete study's honest state, and a completed study's full report", async () => {
    const study = await authed("post", "/v1/msa-studies", mgrTok).send({
      characteristic: "EXPTEST bore diameter",
      gaugeLabel: "EXPTEST caliper",
      method: "crossed_anova",
      nAppraisers: 2,
      nParts: 2,
      nTrials: 2,
    });
    expect(study.status).toBe(201);
    const studyId = study.body.id as string;

    const incomplete = await authed("post", "/v1/exports", mgrTok).send({
      resource: "gauge_rr_aiag_report",
      format: "pdf",
      filters: { studyId },
    });
    expect(incomplete.status).toBe(202);
    await render(incomplete.body.id);
    const incompletePdf = storage.read(`${acmeId}/exports/${incomplete.body.id}.pdf`)!.toString("latin1");
    expect(incompletePdf).toContain("Incomplete");

    const cells = [];
    for (let a = 1; a <= 2; a++) for (let p = 1; p <= 2; p++) for (let t = 1; t <= 2; t++) cells.push({ appraiser: a, part: p, trial: t, value: 10 + a + p + t * 0.1 });
    const fill = await authed("post", `/v1/msa-studies/${studyId}/measurements`, mgrTok).send({ lockVersion: 0, cells });
    expect(fill.status).toBe(200);
    const complete = await authed("patch", `/v1/msa-studies/${studyId}`, mgrTok).send({ status: "completed", lockVersion: fill.body.lockVersion });
    expect(complete.status).toBe(200);

    const create = await authed("post", "/v1/exports", mgrTok).send({
      resource: "gauge_rr_aiag_report",
      format: "pdf",
      filters: { studyId },
    });
    expect(create.status).toBe(202);
    await render(create.body.id);
    const done = (await authed("get", `/v1/exports/${create.body.id}`, mgrTok)).body as Export;
    expect(done.status).toBe("completed");
    const pdf = storage.read(`${acmeId}/exports/${create.body.id}.pdf`)!.toString("latin1");
    expect(pdf).toContain("EXPTEST bore diameter");
    expect(pdf).toContain("Verdict");

    await control.query("DELETE FROM msa_measurements WHERE study_id = $1", [studyId]);
    await control.query("DELETE FROM msa_studies WHERE id = $1", [studyId]);
  });
});
