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
    const started = await inspections.start(tx, tenantId, { role: "admin", plantIds: [] }, userId, done.id, done.lockVersion, ctx);
    await inspections.complete(
      tx,
      tenantId,
      { role: "admin", plantIds: [] },
      userId,
      done.id,
      { guard: "pass", ppe: "yes", housekeeping: 4 },
      started.lockVersion,
      ctx,
    );
  });

  console.log(`Seeded. Sign in at /login as ${EMAIL} / ${PASSWORD} (workspace: ${TENANT}).`);
  await control.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
