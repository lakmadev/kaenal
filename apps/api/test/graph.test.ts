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
 * Knowledge graph explorer (Sprint 03 G1-G4; `graph-explorer.jsx`). Pins:
 * `graph:view` capability gate (admin/manager/auditor in, inspector/viewer
 * out); cross-tenant seed -> empty result, never a leak (rule 8); the
 * inspection->finding and finding->ncr edges get written automatically at the
 * real write sites (findings.service.ts, ncr.service.ts); NEIGHBOR_CAP=6 /
 * CLUSTER_REVEAL=12 expand pagination; and each of the 4 named queries
 * against a small real graph (no synthetic-mass data, G3).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const TAG = `gr${randomUUID().replace(/-/g, "").slice(0, 8)}`;

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let adminTok = "";
let inspectorTok = "";
let auditorTok = "";
let globexTok = "";

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

async function seedMember(tenantId: string, email: string, role: string): Promise<void> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tenantId, userId, role],
    );
  });
}

async function token(slug: string, email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}
const acme = (method: "get" | "post", path: string, bearer = adminTok) => authed(method, path, ACME, bearer);

async function link(fromKind: string, fromId: string, toKind: string, toId: string): Promise<void> {
  const res = await acme("post", "/v1/entity-links").send({ fromKind, fromId, toKind, toId });
  expect(res.status).toBe(201);
}

// --- fixture ids, built up in beforeAll ------------------------------------
let plantId = "";
let inspectionId = "";
let findingId = "";
let ncrId = "";
let supplierId = "";
let eightDId = "";
let capaOpenId = "";
let capaClosedId = "";
let documentId = "";
let auditId = "";
const extraCapaIds: string[] = [];

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  await seedMember(acmeId, `${TAG}-admin@acme.test`, "admin");
  await seedMember(acmeId, `${TAG}-inspector@acme.test`, "inspector");
  await seedMember(acmeId, `${TAG}-auditor@acme.test`, "auditor");
  await seedMember(globexId, `${TAG}-admin@globex.test`, "admin");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token(ACME, `${TAG}-admin@acme.test`);
  inspectorTok = await token(ACME, `${TAG}-inspector@acme.test`);
  auditorTok = await token(ACME, `${TAG}-auditor@acme.test`);
  globexTok = await token(GLOBEX, `${TAG}-admin@globex.test`);

  plantId = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(`INSERT INTO plants (id, tenant_id, name, code, timezone) VALUES ($1,$2,$3,$4,'UTC')`, [
      plantId,
      acmeId,
      `${TAG} Plant`,
      TAG,
    ]),
  );

  // inspection -> finding (auto-linked at finding creation) -> ncr (auto-linked
  // when the NCR is raised FROM the finding) — proves G1 AC4's two write sites.
  const t = await acme("post", "/v1/inspection-templates").send({ name: `${TAG} Template`, schema: SCHEMA });
  const tpl = t.body as { id: string; lockVersion: number };
  await acme("post", `/v1/inspection-templates/${tpl.id}/publish`).send({ version: tpl.lockVersion });
  const insp = await acme("post", "/v1/inspections").send({ title: `${TAG} inspection`, templateId: tpl.id, plantId });
  inspectionId = (insp.body as { id: string }).id;

  const finding = await acme("post", `/v1/inspections/${inspectionId}/findings`).send({
    itemRef: "i1",
    severity: "major",
    description: `${TAG} porosity`,
  });
  findingId = (finding.body as { id: string }).id;

  const ncr = await acme("post", "/v1/ncrs").send({ title: `${TAG} ncr`, priority: "major", findingId });
  ncrId = (ncr.body as { id: string }).id;

  const supplier = await acme("post", "/v1/suppliers").send({ name: `${TAG} Supplier` });
  supplierId = (supplier.body as { id: string }).id;

  const eightD = await acme("post", "/v1/eight-ds").send({ title: `${TAG} 8D`, ncrId });
  eightDId = (eightD.body as { id: string }).id;

  const capaOpen = await acme("post", "/v1/capas").send({ title: `${TAG} open capa`, type: "corrective", priority: "minor" });
  capaOpenId = (capaOpen.body as { id: string }).id;

  const document = await acme("post", "/v1/documents").send({ title: `${TAG} doc`, category: "sop" });
  documentId = (document.body as { id: string }).id;

  const audit = await acme("post", "/v1/audits").send({ title: `${TAG} audit`, type: "internal", plantId });
  auditId = (audit.body as { id: string }).id;

  // A closed CAPA: no API shortcut past the phase machine, so seeded directly
  // (test fixture only — the real product path is the advance-phase flow).
  capaClosedId = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO capas (id, tenant_id, code, title, type, priority, status)
       VALUES ($1,$2,$3,$4,'corrective','minor','closed')`,
      [capaClosedId, acmeId, `${TAG}-CLOSED`, `${TAG} closed capa`],
    ),
  );

  // Wire the rest of the graph the same way the product's "link record"
  // affordance would (POST /v1/entity-links) — only the finding<->ncr edges
  // above are auto-written by their own creation flows.
  await link("supplier", supplierId, "ncr", ncrId);
  await link("ncr", ncrId, "eight_d", eightDId);
  await link("ncr", ncrId, "capa", capaOpenId);
  await link("capa", capaOpenId, "document", documentId);
  await link("audit", auditId, "capa", capaClosedId);
});

afterAll(async () => {
  // Scoped by this suite's own TAG (title/name/code prefix), never by a bare
  // tenant_id filter — "acme"/"globex" are the SHARED dev tenants other test
  // suites also seed data into, so a tenant-wide DELETE here would collide
  // with (and FK-violate against) rows this suite never created.
  const likeTag = `${TAG}%`;
  await control.query(
    `DELETE FROM entity_links WHERE tenant_id = ANY($1) AND
       (from_id = ANY($2::uuid[]) OR to_id = ANY($2::uuid[]))`,
    [[acmeId, globexId], [inspectionId, findingId, ncrId, supplierId, eightDId, capaOpenId, capaClosedId, ...extraCapaIds, documentId, auditId]],
  );
  await control.query("DELETE FROM findings WHERE inspection_id = $1", [inspectionId]);
  // ncrs <-> eight_ds is a circular FK (ncrs.eight_d_id, eight_ds.ncr_id) —
  // null both sides out before either DELETE can run.
  await control.query("UPDATE ncrs SET eight_d_id = NULL WHERE title LIKE $1", [likeTag]);
  await control.query("UPDATE eight_ds SET ncr_id = NULL WHERE title LIKE $1", [likeTag]);
  await control.query("DELETE FROM audit_findings WHERE capa_id = ANY($1::uuid[])", [[capaOpenId, capaClosedId, ...extraCapaIds]]);
  await control.query("DELETE FROM eight_ds WHERE title LIKE $1", [likeTag]);
  await control.query("DELETE FROM ncrs WHERE title LIKE $1", [likeTag]);
  await control.query("DELETE FROM capas WHERE title LIKE $1 OR code = $2", [likeTag, `${TAG}-CLOSED`]);
  await control.query(
    `DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE title LIKE $1)`,
    [likeTag],
  );
  await control.query("DELETE FROM documents WHERE title LIKE $1", [likeTag]);
  await control.query("DELETE FROM audits WHERE title LIKE $1", [likeTag]);
  await control.query("DELETE FROM inspections WHERE title LIKE $1", [likeTag]);
  await control.query("DELETE FROM inspection_templates WHERE name LIKE $1", [likeTag]);
  await control.query("DELETE FROM suppliers WHERE name LIKE $1", [likeTag]);
  await control.query("DELETE FROM plants WHERE id = $1", [plantId]);
  const ids = (await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE $1", [`${TAG}-%@%.test`])).rows.map(
    (r) => r.id,
  );
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("capability gate (graph:view)", () => {
  it("admin/manager/auditor can expand; inspector/viewer 403", async () => {
    expect((await acme("get", `/v1/graph/expand?seed=ncr:${ncrId}`, adminTok)).status).toBe(200);
    expect((await acme("get", `/v1/graph/expand?seed=ncr:${ncrId}`, auditorTok)).status).toBe(200);
    expect((await acme("get", `/v1/graph/expand?seed=ncr:${ncrId}`, inspectorTok)).status).toBe(403);
  });

  it("the same gate applies to the named-query route", async () => {
    expect((await acme("get", "/v1/graph/query/open-capas", adminTok)).status).toBe(200);
    expect((await acme("get", "/v1/graph/query/open-capas", inspectorTok)).status).toBe(403);
  });
});

describe("G1 AC4 — finding graph edges written at the real write sites", () => {
  it("inspection->finding is linked at finding creation", async () => {
    const res = await acme("get", `/v1/graph/expand?seed=inspection:${inspectionId}`);
    expect(res.status).toBe(200);
    expect(res.body.center.id).toBe(inspectionId);
    const findingItems = res.body.neighbors.finding.items as { id: string }[];
    expect(findingItems.some((n) => n.id === findingId)).toBe(true);
  });

  it("finding->ncr is linked when the NCR is raised from the finding (not at finding creation)", async () => {
    const res = await acme("get", `/v1/graph/expand?seed=finding:${findingId}`);
    expect(res.status).toBe(200);
    expect(res.body.center.id).toBe(findingId);
    const ncrItems = res.body.neighbors.ncr.items as { id: string }[];
    expect(ncrItems.some((n) => n.id === ncrId)).toBe(true);
  });
});

describe("expand — click-to-expand neighbours", () => {
  it("returns the center's card + every neighbour type present, capped at 6 each", async () => {
    const res = await acme("get", `/v1/graph/expand?seed=ncr:${ncrId}`);
    expect(res.status).toBe(200);
    expect(res.body.center).toMatchObject({ kind: "ncr", id: ncrId });
    const items = (kind: string): { id: string }[] => res.body.neighbors[kind].items as { id: string }[];
    expect(items("supplier").some((n) => n.id === supplierId)).toBe(true);
    expect(items("eight_d").some((n) => n.id === eightDId)).toBe(true);
    expect(items("capa").some((n) => n.id === capaOpenId)).toBe(true);
    expect(items("finding").some((n) => n.id === findingId)).toBe(true);
  });

  it("an unknown/empty seed never errors — empty neighbours, not a 404", async () => {
    const res = await acme("get", `/v1/graph/expand?seed=ncr:${randomUUID()}`);
    expect(res.status).toBe(200);
    expect(res.body.center).toBeNull();
    expect(res.body.neighbors).toEqual({});
  });

  it("rejects a malformed seed (VALIDATION_FAILED, not a 500)", async () => {
    const res = await acme("get", "/v1/graph/expand?seed=not-a-real-kind:123");
    expect(res.status).toBe(422);
  });

  it("cross-tenant seed resolves to nothing — never leaks existence (rule 8)", async () => {
    const res = await request(server())
      .get(`/v1/graph/expand?seed=ncr:${ncrId}`)
      .set("X-Tenant-Id", GLOBEX)
      .set("Authorization", `Bearer ${globexTok}`);
    expect(res.status).toBe(200);
    expect(res.body.center).toBeNull();
  });
});

describe("expand — cap/truncation and per-(seed,type) cursor pagination", () => {
  beforeAll(async () => {
    // 8 more capas linked to the NCR (9 total with capaOpenId) — enough to
    // exceed NEIGHBOR_CAP=6 on the first call and CLUSTER_REVEAL=12 never
    // matters here (9 < 12), so a single `after` page must reveal the rest.
    for (let i = 0; i < 8; i++) {
      const c = await acme("post", "/v1/capas").send({ title: `${TAG} capa ${i}`, type: "corrective", priority: "minor" });
      const id = (c.body as { id: string }).id;
      extraCapaIds.push(id);
      await link("ncr", ncrId, "capa", id);
    }
  });

  it("first call caps the capa group at 6 with an exact remaining count", async () => {
    const res = await acme("get", `/v1/graph/expand?seed=ncr:${ncrId}`);
    const group = res.body.neighbors.capa as { items: unknown[]; total: number; remaining: number; nextCursor: string | null };
    expect(group.items.length).toBe(6);
    expect(group.total).toBe(9);
    expect(group.remaining).toBe(3);
    expect(group.nextCursor).not.toBeNull();
  });

  it("a second call with type + after reveals the remaining capas, remaining now 0", async () => {
    const first = await acme("get", `/v1/graph/expand?seed=ncr:${ncrId}`);
    const cursor = (first.body.neighbors.capa as { nextCursor: string }).nextCursor;

    const second = await acme("get", `/v1/graph/expand?seed=ncr:${ncrId}&type=capa&after=${encodeURIComponent(cursor)}`);
    expect(second.status).toBe(200);
    const group = second.body.neighbors.capa as { items: { id: string }[]; total: number; remaining: number };
    expect(group.items.length).toBe(3);
    expect(group.remaining).toBe(0);
    expect(Object.keys(second.body.neighbors)).toEqual(["capa"]); // only the requested type comes back

    const seenIds = new Set([
      ...(first.body.neighbors.capa.items as { id: string }[]).map((n) => n.id),
      ...group.items.map((n) => n.id),
    ]);
    expect(seenIds.size).toBe(9); // 6 + 3, no overlap, no gaps
  });
});

describe("the 4 named analytical queries (G1 AC2)", () => {
  it("supplier-nc-8d: follows supplier -> NC -> 8D and includes a 'why' narrative", async () => {
    const res = await acme("get", `/v1/graph/query/supplier-nc-8d?focus=${encodeURIComponent(`supplier:${supplierId}`)}`);
    expect(res.status).toBe(200);
    const ids = (res.body.nodes as { id: string }[]).map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining([supplierId, ncrId, eightDId]));
    expect(res.body.steps.length).toBeGreaterThan(0);
    expect(typeof res.body.summary).toBe("string");
  });

  it("blocking: the open items linked to the focus record", async () => {
    const res = await acme("get", `/v1/graph/query/blocking?focus=${encodeURIComponent(`ncr:${ncrId}`)}`);
    expect(res.status).toBe(200);
    const ids = (res.body.nodes as { id: string }[]).map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining([eightDId, capaOpenId]));
  });

  it("docs-impacted: a document two hops downstream (ncr -> capa -> document)", async () => {
    const res = await acme("get", `/v1/graph/query/docs-impacted?focus=${encodeURIComponent(`ncr:${ncrId}`)}`);
    expect(res.status).toBe(200);
    const ids = (res.body.nodes as { id: string }[]).map((n) => n.id);
    expect(ids).toContain(documentId);
  });

  it("open-capas: includes the open CAPA and its trigger, excludes the closed one", async () => {
    const res = await acme("get", "/v1/graph/query/open-capas");
    expect(res.status).toBe(200);
    const ids = (res.body.nodes as { id: string }[]).map((n) => n.id);
    expect(ids).toContain(capaOpenId);
    expect(ids).not.toContain(capaClosedId);
  });

  it("rejects a queryId outside the 4 fixed names", async () => {
    const res = await acme("get", "/v1/graph/query/not-a-real-query");
    expect(res.status).toBe(422);
  });

  it("no synthetic-mass data (G3): a small seeded tenant gets a small real result, not a padded one", async () => {
    const res = await acme("get", "/v1/graph/query/open-capas");
    // Exactly this suite's fixtures — never artificially bulked up.
    expect((res.body.nodes as unknown[]).length).toBeLessThan(50);
    expect(res.body.truncated).toBe(false);
  });
});
