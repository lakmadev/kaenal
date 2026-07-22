/**
 * Demo seed (dev only) — makes the `acme` workspace loginable and gives the web
 * app something to render. The provisioned admin ships with no credential (see
 * PROGRESS.md Known issues), so nothing is loginable out of the box; this
 * creates a real password + a published template + a few inspections in the
 * three lifecycle states.
 *
 * Idempotent: safe to re-run. Never wire it into production — it sets a known
 * password.
 *
 *   pnpm --filter @kaenal/api seed:demo
 */
import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });

import pg from "pg";
import type { FormSchema } from "@kaenal/types";
import { withTenant } from "@kaenal/db";
import { hashPassword } from "../src/auth/passwords.js";
import { TemplatesService } from "../src/inspections/templates.service.js";
import { InspectionsService } from "../src/inspections/inspections.service.js";
import { FindingsService } from "../src/ncr/findings.service.js";
import { NcrService } from "../src/ncr/ncr.service.js";
import { CapaService } from "../src/capa/capa.service.js";
import { DocumentsService } from "../src/documents/documents.service.js";
import { EightDService } from "../src/eight-d/eight-d.service.js";
import { AuditsService } from "../src/audits/audits.service.js";

const TENANT = "acme";
const EMAIL = "demo@acme.test";
const PASSWORD = "demo-password-1234";
const TEMPLATE_NAME = "Line Safety Walk (demo)";

const SCHEMA: FormSchema = {
  sections: [
    {
      id: "safety",
      title: "Safety checks",
      weight: 1,
      items: [
        { id: "guard", type: "pass_fail", label: "Machine guard fitted", required: true, weight: 2, naAllowed: false },
        { id: "ppe", type: "yes_no", label: "PPE worn by all operators", required: true, weight: 1, naAllowed: true },
        { id: "housekeeping", type: "score", label: "Housekeeping (0–5)", required: true, weight: 1, naAllowed: false, min: 0, max: 5 },
        { id: "notes", type: "textarea", label: "Notes", required: false, weight: 1, naAllowed: false },
      ],
    },
  ],
};

const ctx = { requestId: null, ip: null, userAgent: null };

async function main(): Promise<void> {
  const control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const templates = new TemplatesService();
  const inspections = new InspectionsService();
  const findings = new FindingsService();
  const ncrs = new NcrService();
  const capas = new CapaService();
  const documents = new DocumentsService();
  const eightDs = new EightDService();
  const audits = new AuditsService(ncrs, capas);
  const admin = { role: "admin" as const, plantIds: [] };

  const { rows: tenantRows } = await control.query<{ id: string }>(
    "SELECT id FROM control.tenants WHERE slug = $1",
    [TENANT],
  );
  const tenantId = tenantRows[0]?.id;
  if (tenantId === undefined) throw new Error(`Tenant '${TENANT}' is not provisioned — run provision-tenant first`);

  // Person + admin membership with a known password.
  const hash = await hashPassword(PASSWORD);
  const { rows: userRows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash)
     VALUES ($1, 'Demo Admin', $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [EMAIL, hash],
  );
  const userId = userRows[0]!.id;

  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'admin', status = 'active'`,
      [tenantId, userId],
    );
  });

  // Already seeded? Then just refreshing the credential above is enough.
  const already = await withTenant(tenantId, userId, (tx) =>
    tx.query<{ id: string }>("SELECT id FROM inspection_templates WHERE name = $1 LIMIT 1", [TEMPLATE_NAME]),
  );
  if (already.rows.length > 0) {
    console.log(`Demo already seeded. Sign in at /login as ${EMAIL} / ${PASSWORD} (workspace: ${TENANT}).`);
    await control.end();
    return;
  }

  await withTenant(tenantId, userId, async (tx) => {
    const draft = await templates.create(tx, tenantId, userId, { name: TEMPLATE_NAME, schema: SCHEMA }, ctx);
    const template = await templates.publish(tx, tenantId, userId, draft.id, draft.lockVersion, ctx);

    // One scheduled, one in-progress, one completed (scored).
    await inspections.create(tx, tenantId, userId, { title: "Line 1 — weekly walk", templateId: template.id }, ctx);

    const running = await inspections.create(tx, tenantId, userId, { title: "Line 2 — weekly walk", templateId: template.id }, ctx);
    await inspections.start(tx, tenantId, { role: "admin", plantIds: [] }, userId, running.id, running.lockVersion, ctx);

    const done = await inspections.create(tx, tenantId, userId, { title: "Line 3 — weekly walk", templateId: template.id }, ctx);
    const started = await inspections.start(tx, tenantId, admin, userId, done.id, done.lockVersion, ctx);
    await inspections.complete(
      tx,
      tenantId,
      admin,
      userId,
      done.id,
      { guard: "pass", ppe: "yes", housekeeping: 4 },
      started.lockVersion,
      ctx,
    );

    // A finding on that inspection, and an NCR raised from it — so the
    // findings/NCR endpoints have data too. The NCR is left mid-workflow
    // (assigned) to show a live case.
    const finding = await findings.create(
      tx,
      tenantId,
      admin,
      userId,
      done.id,
      { itemRef: "guard", severity: "major", description: "Guard interlock intermittently disengages" },
      ctx,
    );
    const ncr = await ncrs.create(
      tx,
      tenantId,
      admin,
      userId,
      { title: "Guard interlock fault on Line 3", priority: "major", findingId: finding.id },
      ctx,
    );
    await ncrs.transition(
      tx,
      tenantId,
      admin,
      userId,
      ncr.id,
      { to: "assigned", ownerId: userId, version: ncr.lockVersion },
      ctx,
    );

    // A corrective CAPA, advanced one phase past initiation so the CAPA
    // endpoints have a live, mid-programme case to show.
    const capa = await capas.create(
      tx,
      tenantId,
      userId,
      {
        title: "Interlock reliability programme",
        type: "corrective",
        priority: "major",
        sourceKind: "ncr",
        sourceId: ncr.id,
      },
      ctx,
    );
    await capas.advance(tx, tenantId, userId, capa.id, { to: "root_cause", version: capa.lockVersion }, ctx);

    // An 8D opened from that NCR (blocks its close) with D1 complete, so the
    // 8D endpoints show a live case mid-investigation.
    const eightD = await eightDs.create(
      tx,
      tenantId,
      userId,
      { title: "8D — Guard interlock fault", ncrId: ncr.id },
      ctx,
    );
    await eightDs.updateStep(tx, tenantId, userId, eightD.id, 1, { status: "complete", version: eightD.lockVersion }, ctx);

    // A certification audit in fieldwork with a finding that spawned a CAPA, so
    // the audit + audit-findings endpoints show a live case with a linkage.
    const audit = await audits.create(
      tx,
      tenantId,
      admin,
      userId,
      { title: "IATF 16949 surveillance audit", type: "certification", standard: "IATF 16949:2016" },
      ctx,
    );
    await audits.advance(tx, tenantId, admin, userId, audit.id, { to: "preparation", version: audit.lockVersion }, ctx);
    const auditFinding = await audits.createFinding(
      tx,
      tenantId,
      admin,
      userId,
      audit.id,
      { kind: "minor_nc", clause: "7.1.5", description: "Calibration records incomplete for gauge G-14" },
      ctx,
    );
    await audits.raiseCapa(
      tx,
      tenantId,
      admin,
      userId,
      auditFinding.id,
      { type: "corrective", priority: "minor" },
      ctx,
    );

    // A controlled document, submitted and awaiting review — left at `pending`
    // because approval is four-eyes and this seed has only one user, so the
    // demo admin cannot approve their own document.
    const doc = await documents.create(
      tx,
      tenantId,
      userId,
      { title: "Line Safety Work Instruction", category: "work_instruction" },
      ctx,
    );
    await documents.transition(tx, tenantId, admin, userId, doc.id, { to: "pending", version: doc.lockVersion }, ctx);
  });

  console.log(`Seeded. Sign in at /login as ${EMAIL} / ${PASSWORD} (workspace: ${TENANT}).`);
  await control.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
