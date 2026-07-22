import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import type { FormSchema } from "@kaenal/types";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Search slice (03 §1, 04 command palette).
 *
 * One `GET /v1/search` federates full-text search across inspections, NCRs,
 * CAPAs and documents, ranked over each entity's generated `search_vector`
 * (migration 0008). This suite proves the federation (a term seeded in all four
 * kinds comes back grouped), the top-6-per-kind cap, and that plant scoping is
 * honoured — an inspector bounded to plant A does not find an NCR in plant B,
 * though an admin does.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";
const TERM = `srch${randomUUID().replace(/-/g, "").slice(0, 8)}`; // unique, unstemmed
const CAPTERM = `srchcap${randomUUID().replace(/-/g, "").slice(0, 6)}`;
const PLANTTERM = `srchpb${randomUUID().replace(/-/g, "").slice(0, 6)}`;

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let plantA = "";
let plantB = "";
let adminTok = "";
let inspectorTok = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

const SCHEMA: FormSchema = {
  sections: [
    {
      id: "s1",
      title: "Checks",
      weight: 1,
      items: [{ id: "guard", type: "pass_fail", label: "Guard", required: true, weight: 1, naAllowed: false }],
    },
  ],
};

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
  const id = randomUUID();
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(`INSERT INTO plants (id, tenant_id, name, code, timezone) VALUES ($1,$2,$3,$4,'UTC')`, [id, acmeId, code, code]);
  });
  return id;
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

interface Hit {
  kind: string;
  id: string;
  code: string;
  title: string;
  rank: number;
}
async function search(term: string, bearer = adminTok): Promise<Hit[]> {
  const res = await authed("get", `/v1/search?q=${encodeURIComponent(term)}`, bearer);
  expect(res.status).toBe(200);
  return res.body.items as Hit[];
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  plantA = await seedPlant("SRCHPA");
  plantB = await seedPlant("SRCHPB");
  await seedMember("srch-admin@acme.test", "admin", []);
  await seedMember("srch-inspector@acme.test", "inspector", [plantA]);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  adminTok = await token("srch-admin@acme.test");
  inspectorTok = await token("srch-inspector@acme.test");

  // One record of each kind carrying TERM, so search federates across all four.
  const t = await authed("post", "/v1/inspection-templates", adminTok).send({ name: `SRCH ${randomUUID()}`, schema: SCHEMA });
  const tpl = t.body as { id: string; lockVersion: number };
  await authed("post", `/v1/inspection-templates/${tpl.id}/publish`, adminTok).send({ version: tpl.lockVersion });
  await authed("post", "/v1/inspections", adminTok).send({ title: `SRCH inspection ${TERM}`, templateId: tpl.id, plantId: plantA });
  await authed("post", "/v1/ncrs", adminTok).send({ title: `SRCH ncr ${TERM}`, priority: "minor", plantId: plantA });
  await authed("post", "/v1/capas", adminTok).send({ title: `SRCH capa ${TERM}`, type: "corrective", priority: "minor" });
  await authed("post", "/v1/documents", adminTok).send({ title: `SRCH document ${TERM}`, category: "sop" });

  // Seven NCRs with CAPTERM, to exercise the top-6-per-kind cap.
  for (let i = 0; i < 7; i++) {
    await authed("post", "/v1/ncrs", adminTok).send({ title: `SRCH cap ${CAPTERM} ${i}`, priority: "minor", plantId: plantA });
  }

  // An NCR in plant B carrying PLANTTERM — visible to admin, not to the plant-A inspector.
  await authed("post", "/v1/ncrs", adminTok).send({ title: `SRCH plantb ${PLANTTERM}`, priority: "minor", plantId: plantB });
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'srch-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM ncrs WHERE title LIKE 'SRCH %'");
  await control.query("DELETE FROM capas WHERE title LIKE 'SRCH %'");
  await control.query(
    "DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE title LIKE 'SRCH %')",
  );
  await control.query("DELETE FROM documents WHERE title LIKE 'SRCH %'");
  await control.query("DELETE FROM inspections WHERE title LIKE 'SRCH %'");
  await control.query("DELETE FROM inspection_templates WHERE name LIKE 'SRCH %'");
  await control.query("DELETE FROM plants WHERE code LIKE 'SRCHP%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("federated search", () => {
  it("returns hits across all four record kinds for one term", async () => {
    const hits = await search(TERM);
    const kinds = new Set(hits.map((h) => h.kind));
    expect(kinds).toEqual(new Set(["inspection", "ncr", "capa", "document"]));
    for (const h of hits) expect(h.title).toContain(TERM);
  });

  it("caps results at six per kind", async () => {
    const hits = await search(CAPTERM);
    const ncrHits = hits.filter((h) => h.kind === "ncr");
    expect(ncrHits.length).toBe(6); // seven seeded, capped at six
  });

  it("returns nothing for a term that matches no record", async () => {
    const hits = await search(`nomatch${randomUUID().slice(0, 8)}`);
    expect(hits).toEqual([]);
  });

  it("requires a non-empty query", async () => {
    const res = await authed("get", "/v1/search", adminTok);
    expect(res.status).toBe(422);
  });
});

describe("plant scoping", () => {
  it("hides an out-of-scope NCR from a plant-bound inspector but not from an admin", async () => {
    const asAdmin = await search(PLANTTERM, adminTok);
    expect(asAdmin.some((h) => h.kind === "ncr")).toBe(true);

    const asInspector = await search(PLANTTERM, inspectorTok);
    expect(asInspector.some((h) => h.kind === "ncr")).toBe(false);
  });
});
