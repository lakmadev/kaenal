import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import type { Membership } from "@kaenal/core";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";
import { EntityLinksService } from "../src/collab/entity-links.service.js";
import { isEntityVisible } from "../src/collab/entity-ref.js";

/**
 * Entity-links label resolution (SPRINT-04 R3 `[AMENDED-2]`). Pins: risk<->fmea
 * become real `entity_links` endpoints (not the prototype's dead `kToast`);
 * `GET/POST /v1/entity-links` responses carry a server-resolved, capability-
 * checked `label` per link, present only when the caller holds that kind's
 * own `:view` capability, omitted (never raw/guessed) otherwise; and a
 * foreign-tenant link target is a 404, never a 403 or a leak (rule 8).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const TAG = `el${randomUUID().replace(/-/g, "").slice(0, 8)}`;

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let mgrTok = "";
let globexMgrTok = "";
let mgrUserId = "";
let inspectorTok = ""; // scoped to plantHome only
let plantHome = "";
let plantForeign = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(tenantId: string, email: string, role: string, plantIds: string[] = []): Promise<string> {
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
      `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status) VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, plant_ids = EXCLUDED.plant_ids, status = 'active'`,
      [tenantId, userId, role, plantIds],
    );
  });
  return userId;
}

async function seedPlant(tenantId: string, code: string): Promise<string> {
  const id = randomUUID();
  await withTenant(tenantId, null, (tx) =>
    tx.query(`INSERT INTO plants (id, tenant_id, name, code, timezone) VALUES ($1,$2,$3,$4,'UTC')`, [id, tenantId, code, code]),
  );
  return id;
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
const acme = (method: "get" | "post", path: string, bearer = mgrTok) => authed(method, path, ACME, bearer);

async function cleanup(): Promise<void> {
  await control.query(`DELETE FROM entity_links WHERE tenant_id = ANY($1)`, [[acmeId, globexId]]);
  await control.query(`DELETE FROM risks WHERE tenant_id = ANY($1) AND title LIKE $2`, [[acmeId, globexId], `${TAG}%`]);
  await control.query(`DELETE FROM fmeas WHERE tenant_id = ANY($1) AND part_code LIKE $2`, [[acmeId, globexId], `${TAG}%`]);
  await control.query(`DELETE FROM ncrs WHERE tenant_id = $1 AND title LIKE $2`, [acmeId, `${TAG}%`]);
  await control.query(`DELETE FROM capas WHERE tenant_id = $1 AND title LIKE $2`, [acmeId, `${TAG}%`]);
  await control.query(
    `DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE tenant_id = $1 AND title LIKE $2)`,
    [acmeId, `${TAG}%`],
  );
  await control.query(`DELETE FROM documents WHERE tenant_id = $1 AND title LIKE $2`, [acmeId, `${TAG}%`]);
  await control.query(`DELETE FROM plants WHERE tenant_id = $1 AND code LIKE $2`, [acmeId, `${TAG}%`]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  plantHome = await seedPlant(acmeId, `${TAG}-HOME`);
  plantForeign = await seedPlant(acmeId, `${TAG}-FOREIGN`);
  mgrUserId = await seedMember(acmeId, `${TAG}-mgr@acme.test`, "manager");
  await seedMember(globexId, `${TAG}-mgr@globex.test`, "manager");
  // Plant-scoped role (rbac.ts PLANT_SCOPED_ROLES), assigned only `plantHome`.
  await seedMember(acmeId, `${TAG}-inspector@acme.test`, "inspector", [plantHome]);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(ACME, `${TAG}-mgr@acme.test`);
  globexMgrTok = await token(GLOBEX, `${TAG}-mgr@globex.test`);
  inspectorTok = await token(ACME, `${TAG}-inspector@acme.test`);
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE $1", [`${TAG}-%@%.test`])
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  } else {
    await control.query("SELECT $1::uuid", [randomUUID()]);
  }
  await control.end();
  await app.close();
});

describe("risk <-> fmea entity links (R3)", () => {
  it("links a risk to an FMEA, and the response carries a resolved label for a capability-holding caller", async () => {
    const risk = await acme("post", "/v1/risks").send({
      category: "quality",
      title: `${TAG} supplier weld risk`,
      owner: mgrUserId,
      likelihood: 3,
      impact: 4,
      treatment: "mitigate",
    });
    expect(risk.status).toBe(201);
    const riskId = risk.body.id as string;

    const fmea = await acme("post", "/v1/fmeas").send({ type: "pfmea", partCode: `${TAG}-PART`, partName: `${TAG} bracket` });
    expect(fmea.status).toBe(201);
    const fmeaId = fmea.body.id as string;

    const link = await acme("post", "/v1/entity-links").send({ fromKind: "risk", fromId: riskId, toKind: "fmea", toId: fmeaId });
    expect(link.status).toBe(201);
    // The manager holds both risk:view and fmea:view, so the create response
    // itself already carries the resolved label for the `to` end.
    expect(link.body.label).toBe(`${TAG}-PART — ${TAG} bracket`);

    // Reading from the risk's own side resolves the FMEA's label (a real,
    // per-risk label — not the prototype's fixed four-row mock).
    const fromRisk = await acme("get", `/v1/entity-links?entityKind=risk&entityId=${riskId}`);
    expect(fromRisk.status).toBe(200);
    const riskSideLink = (fromRisk.body.items as { toKind: string; label?: string }[]).find((l) => l.toKind === "fmea");
    expect(riskSideLink?.label).toBe(`${TAG}-PART — ${TAG} bracket`);

    // Reading from the FMEA's own side (the new reverse pane, R3 AC7)
    // resolves the risk's own label the same way.
    const fromFmea = await acme("get", `/v1/entity-links?entityKind=fmea&entityId=${fmeaId}`);
    expect(fromFmea.status).toBe(200);
    const fmeaSideLink = (fromFmea.body.items as { fromKind: string; label?: string }[]).find((l) => l.fromKind === "risk");
    expect(fmeaSideLink?.label).toContain(`${TAG} supplier weld risk`);
  });

  it("omits the label (never a raw/guessed value) when the caller lacks the target kind's :view capability", async () => {
    // Every INTERNAL role in this codebase's current rbac matrix happens to
    // hold both `risk:view` and `fmea:view` (mirrors `fmea:view`/`spc:view`
    // being broadly granted, §1a) — so there is no real internal role today
    // that exercises the "held one side, not the other" branch over HTTP.
    // The gate itself is still real: exercised directly against
    // `isEntityVisible` (the exact function `resolveLabel` calls) with a role
    // that structurally holds neither (`partner`, the external portal role) —
    // proving the label-resolution capability gate is real, never fabricated.
    // (SPRINT-06 §0 B4 widened `assertEntityVisible` itself to ALSO gate the
    // PRIMARY entity on its own :view capability — a partner calling `list`
    // on the risk itself now 404s outright, covered in the next test — so
    // this test exercises the linked-target label gate directly, not via a
    // `list()` call that would 404 before ever reaching label resolution.)
    const risk = await acme("post", "/v1/risks").send({
      category: "quality",
      title: `${TAG} label-visibility risk`,
      owner: mgrUserId,
      likelihood: 2,
      impact: 2,
      treatment: "accept",
    });
    const riskId = risk.body.id as string;
    const fmea = await acme("post", "/v1/fmeas").send({ type: "pfmea", partCode: `${TAG}-HIDDEN`, partName: `${TAG} hidden part` });
    const fmeaId = fmea.body.id as string;
    await acme("post", "/v1/entity-links").send({ fromKind: "risk", fromId: riskId, toKind: "fmea", toId: fmeaId });

    const partnerMembership: Membership = { role: "partner", plantIds: [] };
    const visibleToPartner = await withTenant(acmeId, null, (tx) => isEntityVisible(tx, "fmea", fmeaId, partnerMembership));
    expect(visibleToPartner).toBe(false);

    // The SAME target, read by a role that holds fmea:view, IS visible —
    // proving the gate above is the capability check, not a bug that always
    // denies it.
    const managerMembership: Membership = { role: "manager", plantIds: [] };
    const visibleToManager = await withTenant(acmeId, null, (tx) => isEntityVisible(tx, "fmea", fmeaId, managerMembership));
    expect(visibleToManager).toBe(true);

    const service = new EntityLinksService();
    const seenByManager = await withTenant(acmeId, null, (tx) => service.list(tx, "risk", riskId, managerMembership));
    expect(seenByManager.items.find((l) => l.toKind === "fmea")?.label).toBe(`${TAG}-HIDDEN — ${TAG} hidden part`);
  });

  it("(SPRINT-06 §0 B4) list() now 404s outright for a caller lacking the PRIMARY entity's own :view capability — closing the gap the moment complaint/ecn join EntityKind", async () => {
    const risk = await acme("post", "/v1/risks").send({
      category: "quality",
      title: `${TAG} primary-visibility risk`,
      owner: mgrUserId,
      likelihood: 1,
      impact: 1,
      treatment: "accept",
    });
    const riskId = risk.body.id as string;
    const service = new EntityLinksService();
    const partnerMembership: Membership = { role: "partner", plantIds: [] };
    await expect(withTenant(acmeId, null, (tx) => service.list(tx, "risk", riskId, partnerMembership))).rejects.toThrow();
  });

  it("a foreign-tenant link target is a 404, never a 403 or a leak (rule 8)", async () => {
    const risk = await acme("post", "/v1/risks").send({
      category: "quality",
      title: `${TAG} cross-tenant link risk`,
      owner: mgrUserId,
      likelihood: 1,
      impact: 1,
      treatment: "accept",
    });
    const riskId = risk.body.id as string;

    const foreignFmea = await authed("post", "/v1/fmeas", GLOBEX, globexMgrTok).send({
      type: "pfmea",
      partCode: `${TAG}-FOREIGN`,
      partName: "foreign part",
    });
    const foreignFmeaId = foreignFmea.body.id as string;

    const res = await acme("post", "/v1/entity-links").send({ fromKind: "risk", fromId: riskId, toKind: "fmea", toId: foreignFmeaId });
    expect(res.status).toBe(404);

    await authed("post", `/v1/fmeas/${foreignFmeaId}/delete`, GLOBEX, globexMgrTok).send({});
  });
});

/**
 * SECURITY FIX (post-Sprint-04 review, MEDIUM broken-access-control): a
 * plant-scoped inspector who can view an unscoped CAPA/document must not
 * learn a linked NCR/inspection/audit/finding's real code+title when that
 * target sits in a plant outside `membership.plantIds` — a direct
 * `GET /v1/ncrs/:id` on the same id would 404 them, and `GET /v1/entity-links`
 * must not be a side channel around that. `resolveLabel` (entity-links.service.ts)
 * and `assertEntityVisible` (entity-ref.ts) now both apply the same
 * `PLANT_SCOPED_KINDS` boundary `graph.service.ts`/`chat.ts` already use.
 */
describe("entity-links plant scoping (SECURITY FIX)", () => {
  let capaId = "";
  let ncrForeignId = "";
  let ncrHomeId = "";

  beforeAll(async () => {
    const capa = await acme("post", "/v1/capas").send({ title: `${TAG} scoped capa`, type: "corrective", priority: "minor" });
    expect(capa.status).toBe(201);
    capaId = capa.body.id as string;

    // capa (unscoped) links to two NCRs (plant-scoped): one in the inspector's
    // own plant, one in a plant they are NOT assigned to.
    const ncrForeign = await acme("post", "/v1/ncrs").send({ title: `${TAG} foreign ncr`, priority: "major", plantId: plantForeign });
    expect(ncrForeign.status).toBe(201);
    ncrForeignId = ncrForeign.body.id as string;

    const ncrHome = await acme("post", "/v1/ncrs").send({ title: `${TAG} home ncr`, priority: "major", plantId: plantHome });
    expect(ncrHome.status).toBe(201);
    ncrHomeId = ncrHome.body.id as string;

    const linkForeign = await acme("post", "/v1/entity-links").send({ fromKind: "capa", fromId: capaId, toKind: "ncr", toId: ncrForeignId });
    expect(linkForeign.status).toBe(201);
    const linkHome = await acme("post", "/v1/entity-links").send({ fromKind: "capa", fromId: capaId, toKind: "ncr", toId: ncrHomeId });
    expect(linkHome.status).toBe(201);
  });

  it("omits the label for a linked target in a foreign plant, but resolves it for a same-plant target (exploit closed)", async () => {
    const res = await authed("get", `/v1/entity-links?entityKind=capa&entityId=${capaId}`, ACME, inspectorTok);
    expect(res.status).toBe(200);
    const items = res.body.items as { toId: string; label?: string }[];

    const foreignLink = items.find((l) => l.toId === ncrForeignId);
    expect(foreignLink).toBeDefined();
    // The inspector holds `ncr:view` (so the capability gate alone would have
    // let this through pre-fix) — the label must still be omitted because the
    // target is outside their plant scope. Never a raw/guessed value (rule 8).
    expect(foreignLink?.label).toBeUndefined();

    const homeLink = items.find((l) => l.toId === ncrHomeId);
    expect(homeLink).toBeDefined();
    expect(homeLink?.label).toContain(`${TAG} home ncr`);
  });

  it("resolves the label correctly for a same-plant target and for a manager with no plant restriction (no over-correction)", async () => {
    const res = await authed("get", `/v1/entity-links?entityKind=capa&entityId=${capaId}`, ACME, inspectorTok);
    const homeLink = (res.body.items as { toId: string; label?: string }[]).find((l) => l.toId === ncrHomeId);
    expect(homeLink?.label).toContain(`${TAG} home ncr`);

    // A manager (not plant-scoped) sees both labels regardless of plant.
    const mgrRes = await acme("get", `/v1/entity-links?entityKind=capa&entityId=${capaId}`);
    const items = mgrRes.body.items as { toId: string; label?: string }[];
    expect(items.find((l) => l.toId === ncrForeignId)?.label).toContain(`${TAG} foreign ncr`);
    expect(items.find((l) => l.toId === ncrHomeId)?.label).toContain(`${TAG} home ncr`);
  });

  it("404s (never a leak) when the PRIMARY queried entity itself is a plant-scoped record outside the caller's plants", async () => {
    const direct = await authed("get", `/v1/ncrs/${ncrForeignId}`, ACME, inspectorTok);
    expect(direct.status).toBe(404);

    const viaLinks = await authed("get", `/v1/entity-links?entityKind=ncr&entityId=${ncrForeignId}`, ACME, inspectorTok);
    expect(viaLinks.status).toBe(404);

    // Same primary entity, queried by the same-plant inspector on its own
    // plant's NCR: resolves normally (no over-correction).
    const viaLinksHome = await authed("get", `/v1/entity-links?entityKind=ncr&entityId=${ncrHomeId}`, ACME, inspectorTok);
    expect(viaLinksHome.status).toBe(200);
  });

  it("linking to/from a foreign-plant entity is refused with 404 at create time too (assertEntityVisible), not just hidden on read", async () => {
    const doc = await acme("post", "/v1/documents").send({ title: `${TAG} scoped doc`, category: "sop" });
    const docId = doc.body.id as string;

    const res = await authed("post", "/v1/entity-links", ACME, inspectorTok).send({
      fromKind: "document",
      fromId: docId,
      toKind: "ncr",
      toId: ncrForeignId,
    });
    expect(res.status).toBe(404);
  });
});
