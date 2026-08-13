/**
 * Bulk test-data seed (dev only) — fills the `acme` workspace with enough
 * realistic, INTERLINKED data to exercise the app by hand: 50+ people across
 * every internal role, a spread of published inspection templates, inspections
 * in all three lifecycle states, and a chain of findings → NCRs → 8Ds that are
 * actually wired together (an 8D links its NCR, which links its finding, which
 * links the inspection it was raised on).
 *
 * Everything is mutated through the real services (audit + optimistic
 * concurrency + RLS all exercised), acting as a seeded admin, so the data is
 * indistinguishable from data a real admin would have created in the UI. Owners,
 * inspectors, team leads and 8D members are spread across the seeded people so
 * every people-facing screen resolves to real names.
 *
 * All accounts share the demo password so any of them is easy to sign in with
 * and eyeball what a given role can/can't do. Idempotent-ish: users upsert by
 * email; re-running adds another batch of inspections/NCRs (guarded by a marker
 * so a full double-seed is skipped). NEVER run against production.
 *
 *   pnpm --filter @kaenal/api seed:testdata
 */
import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });

import pg from "pg";
import type { FormSchema, InternalRole } from "@kaenal/types";
import type { Membership } from "@kaenal/core";
import { withTenant } from "@kaenal/db";
import { hashPassword } from "../src/auth/passwords.js";
import { TemplatesService } from "../src/inspections/templates.service.js";
import { InspectionsService } from "../src/inspections/inspections.service.js";
import { FindingsService } from "../src/ncr/findings.service.js";
import { NcrService } from "../src/ncr/ncr.service.js";
import { EightDService } from "../src/eight-d/eight-d.service.js";

const TENANT = "acme";
const PASSWORD = "demo-password-1234";
const OPERATOR_EMAIL = "qa-admin@acme-qa.test";
const MARKER_TEMPLATE = "QA — Final Assembly Audit";
const ctx = { requestId: null, ip: null, userAgent: null };
const admin: Membership = { role: "admin", plantIds: [] };

// --- deterministic RNG so re-runs pick the same shape ----------------------
let _s = 0x9e3779b9;
function rand(): number {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const pickN = <T>(xs: readonly T[], n: number): T[] => {
  const pool = [...xs];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
  return out;
};
const chance = (p: number): boolean => rand() < p;

// --- people ----------------------------------------------------------------
const FIRST = [
  "Sarah", "Marco", "Priya", "Tom", "Aisha", "Chen", "Diego", "Emma", "Farid", "Grace",
  "Hana", "Ivan", "Julia", "Kwame", "Lena", "Mateo", "Nadia", "Omar", "Paula", "Quinn",
  "Rosa", "Sven", "Tara", "Umar", "Vera", "Wei", "Xavier", "Yara", "Zane", "Anya",
  "Bilal", "Carmen", "Deepak", "Elif", "Frank", "Gita", "Hugo", "Ingrid", "Jamal", "Klara",
  "Liam", "Mira", "Noor", "Oscar", "Petra", "Raj", "Sofia", "Tobias", "Uma", "Viktor",
  "Wanda", "Yusuf", "Zoe", "Ana", "Ben", "Cora",
];
const LAST = [
  "Chen", "Reyes", "Nair", "Fischer", "Khan", "Silva", "Novak", "Weber", "Haddad", "Osei",
  "Kim", "Petrov", "Costa", "Mensah", "Berg", "Rossi", "Amin", "Farouk", "Duarte", "Walsh",
  "Vargas", "Larsson", "Iyer", "Yilmaz", "Moreau", "Zhang", "Dubois", "Haas", "Okonkwo", "Ali",
];

// role → count (weighted like a real plant org). Sum = 55 people.
const ROLE_PLAN: { role: InternalRole; count: number }[] = [
  { role: "admin", count: 3 },
  { role: "manager", count: 8 },
  { role: "auditor", count: 6 },
  { role: "inspector", count: 25 },
  { role: "viewer", count: 13 },
];

// --- template vocabulary (item types the seed can auto-answer) -------------

/** Build a randomised, valid schema from the answerable item types. */
function buildSchema(sections: number): FormSchema {
  const secs: FormSchema["sections"] = [];
  for (let s = 0; s < sections; s++) {
    const items: FormSchema["sections"][number]["items"] = [];
    const nItems = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < nItems; i++) {
      const id = `s${s}i${i}`;
      const kind = pick(["pass_fail", "yes_no", "score", "number", "textarea"] as const);
      const required = chance(0.7);
      if (kind === "pass_fail") items.push({ id, type: "pass_fail", label: pick(GUARD_LABELS), required, weight: 2, naAllowed: false });
      else if (kind === "yes_no") items.push({ id, type: "yes_no", label: pick(YESNO_LABELS), required, weight: 1, naAllowed: true });
      else if (kind === "score") items.push({ id, type: "score", label: pick(SCORE_LABELS), required, weight: 1, naAllowed: false, min: 0, max: 5 });
      else if (kind === "number") items.push({ id, type: "number", label: pick(NUM_LABELS), required, weight: 1, naAllowed: false });
      else items.push({ id, type: "textarea", label: "Observations", required: false, weight: 1, naAllowed: false });
    }
    secs.push({ id: `sec${s}`, title: pick(SECTION_TITLES), weight: 1, items });
  }
  return { sections: secs };
}

/**
 * Answer ANY schema (a freshly built one or one loaded from the DB), so the
 * seed can complete inspections against templates it didn't build. Every
 * required item gets a valid answer; optionals are filled ~80% of the time.
 * `forceFail` deliberately fails the first pass_fail/yes_no item so a completed
 * inspection reliably spawns a finding → NCR chain.
 */
function answerSchema(schema: FormSchema, forceFail: boolean): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  let failInjected = false;
  for (const sec of schema.sections) {
    for (const it of sec.items) {
      if (it.type === "header" || it.type === "info") continue;
      const answer = !it.required && !chance(0.8);
      if (answer) continue;
      switch (it.type) {
        case "pass_fail": {
          const fail = (forceFail && !failInjected) || chance(0.18);
          if (forceFail && !failInjected) failInjected = true;
          r[it.id] = fail ? "fail" : "pass";
          break;
        }
        case "yes_no": {
          const no = (forceFail && !failInjected) || chance(0.15);
          if (forceFail && !failInjected) failInjected = true;
          r[it.id] = no ? "no" : "yes";
          break;
        }
        case "score": r[it.id] = 2 + Math.floor(rand() * 4); break;
        case "number": r[it.id] = Number((rand() * 20).toFixed(2)); break;
        case "text": case "textarea": r[it.id] = pick(NOTES); break;
        case "select": if (it.options?.[0] !== undefined) r[it.id] = pick(it.options).value; break;
        case "multiselect": if (it.options?.[0] !== undefined) r[it.id] = [pick(it.options).value]; break;
        case "date": r[it.id] = new Date().toISOString().slice(0, 10); break;
        case "datetime": r[it.id] = new Date().toISOString(); break;
        default: break; // photo/signature — skip (optional/non-scored here)
      }
    }
  }
  return r;
}

const GUARD_LABELS = ["Machine guard fitted", "Emergency stop functional", "Interlock engaged", "Torque within spec", "Fixture seated correctly", "Label present & legible"];
const YESNO_LABELS = ["PPE worn by all operators", "Work instruction at station", "Calibration sticker in date", "Area free of trip hazards", "Containment bin in place"];
const SCORE_LABELS = ["Housekeeping (0–5)", "Surface finish (0–5)", "5S compliance (0–5)", "Operator confidence (0–5)"];
const NUM_LABELS = ["Ambient temperature (°C)", "Gas flow (L/min)", "Cycle time (s)", "Gap measurement (mm)"];
const SECTION_TITLES = ["Safety checks", "Process controls", "Quality gates", "Documentation", "Equipment", "Environment"];
const NOTES = ["Minor scuffing observed on housing.", "Operator flagged intermittent alarm.", "Within tolerance, no action.", "Recommend re-torque next shift.", "Fixture wear trending up."];

const TEMPLATE_NAMES = [
  MARKER_TEMPLATE, "QA — Line Safety Walk", "QA — Incoming Goods Check", "QA — Weld Cell Verification",
  "QA — Paint Booth Inspection", "QA — Torque Audit (Layered)", "QA — 5S Shopfloor Round",
  "QA — Calibration Sweep", "QA — First-Off Approval", "QA — Packaging & Labelling",
  "QA — Machine PM Checklist", "QA — Supplier Dock Audit", "QA — Cleanroom Gowning", "QA — Leak Test Station",
  "QA — Final Dimensional Check", "QA — Forklift Pre-Use",
];

const INSP_PLACES = ["Line 1", "Line 2", "Line 3", "Line 4", "Weld Cell 3", "Paint Booth A", "Assembly 2", "Dock 5", "Cleanroom C", "Test Rig 7"];
const NCR_TITLES = [
  "Porosity at A-pillar weld joint", "Torque out of spec on hinge bolts", "Surface contamination on painted panel",
  "Missing label on outgoing carton", "Dimensional drift on bracket #B-201", "Interlock intermittently disengages",
  "Leak detected at seal interface", "Calibration overdue on gauge G-14", "Foreign object found in housing",
  "Incorrect fastener grade used",
];

async function main(): Promise<void> {
  const control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const templates = new TemplatesService();
  const inspections = new InspectionsService();
  const findings = new FindingsService();
  const ncrs = new NcrService();
  const eightDs = new EightDService();
  const hash = await hashPassword(PASSWORD);

  const { rows: tRows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [TENANT]);
  const tenantId = tRows[0]?.id;
  if (tenantId === undefined) throw new Error(`Tenant '${TENANT}' is not provisioned — run provision-tenant first`);

  // Operator admin we act as for every mutation.
  const { rows: opRows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, 'QA Admin', $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [OPERATOR_EMAIL, hash],
  );
  const operatorId = opRows[0]!.id;
  await withTenant(tenantId, null, (tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'admin','active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role='admin', status='active'`,
      [tenantId, operatorId],
    ),
  );

  // Re-runnable: people upsert by email, QA templates are reused if present,
  // and each run appends a fresh batch of inspections → NCRs → 8Ds (so you can
  // top up volume by running again). Never destructive.
  const rerun = await withTenant(tenantId, operatorId, (tx) =>
    tx.query<{ id: string }>("SELECT id FROM inspection_templates WHERE name = $1 LIMIT 1", [MARKER_TEMPLATE]),
  );
  if (rerun.rows.length > 0) console.log("QA templates already present — reusing them and appending a new batch.");

  // --- 1. people ------------------------------------------------------------
  const byRole: Record<InternalRole, string[]> = { admin: [], manager: [], auditor: [], inspector: [], viewer: [] };
  let n = 0;
  for (const { role, count } of ROLE_PLAN) {
    for (let i = 0; i < count; i++) {
      const first = FIRST[n % FIRST.length]!;
      const last = LAST[(n * 7 + 3) % LAST.length]!;
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${n}@acme-qa.test`;
      const name = `${first} ${last}`;
      const { rows } = await control.query<{ id: string }>(
        `INSERT INTO control.users (email, name, password_hash) VALUES ($1,$2,$3)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [email, name, hash],
      );
      const uid = rows[0]!.id;
      await withTenant(tenantId, null, (tx) =>
        tx.query(
          `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status='active'`,
          [tenantId, uid, role],
        ),
      );
      byRole[role].push(uid);
      n++;
    }
  }
  const allMembers = Object.values(byRole).flat();
  // People who can own/lead work (not pure viewers).
  const doers = [...byRole.admin, ...byRole.manager, ...byRole.auditor, ...byRole.inspector];
  const inspectors = [...byRole.inspector, ...byRole.manager];
  console.log(`Seeded ${n} people (admin ${byRole.admin.length}, manager ${byRole.manager.length}, auditor ${byRole.auditor.length}, inspector ${byRole.inspector.length}, viewer ${byRole.viewer.length}).`);

  // --- 2. templates (create once, reuse on re-run) -------------------------
  const tmpl: { id: string; schema: FormSchema }[] = [];
  await withTenant(tenantId, operatorId, async (tx) => {
    // Pull any QA templates already published (so re-runs don't duplicate them).
    const { rows: existing } = await tx.query<{ id: string; schema: FormSchema }>(
      "SELECT id, schema FROM inspection_templates WHERE name LIKE 'QA — %' AND status = 'published'",
    );
    const haveNames = new Set<string>();
    if (existing.length > 0) {
      const { rows: named } = await tx.query<{ id: string; name: string }>(
        "SELECT id, name FROM inspection_templates WHERE name LIKE 'QA — %' AND status = 'published'",
      );
      for (const r of named) haveNames.add(r.name);
      for (const r of existing) tmpl.push({ id: r.id, schema: r.schema });
    }
    let created = 0;
    for (const name of TEMPLATE_NAMES) {
      if (haveNames.has(name)) continue;
      const schema = buildSchema(1 + Math.floor(rand() * 3));
      const draft = await templates.create(tx, tenantId, operatorId, { name, schema }, ctx);
      const published = await templates.publish(tx, tenantId, operatorId, draft.id, draft.lockVersion, ctx);
      tmpl.push({ id: published.id, schema });
      created++;
    }
    console.log(`Templates — ${created} newly published, ${tmpl.length} available.`);
  });

  // --- 3. inspections + 4. findings → NCR → 8D ------------------------------
  let scheduled = 0, running = 0, completed = 0, ncrCount = 0, eightDCount = 0;

  // Each inspection gets its own committed tx so a later failure never rolls
  // back earlier good data (and matches how the app writes them one at a time).
  const N_INSPECTIONS = 60;
  for (let i = 0; i < N_INSPECTIONS; i++) {
    const template = pick(tmpl);
    const inspectorId = pick(inspectors);
    const title = `${pick(INSP_PLACES)} — ${pick(["weekly", "shift", "layered", "first-off", "monthly"])} check`;
    const roll = rand();
    // ~25% scheduled, ~20% in-progress, ~55% completed.
    const target: "scheduled" | "in_progress" | "completed" = roll < 0.25 ? "scheduled" : roll < 0.45 ? "in_progress" : "completed";
    // Of the completed ones, ~65% are steered to fail an item → raise an NCR.
    const raiseNcr = target === "completed" && chance(0.65);

    await withTenant(tenantId, operatorId, async (tx) => {
      const scheduledAt = chance(0.6) ? new Date(Date.now() + (Math.floor(rand() * 20) - 8) * 86400000).toISOString() : null;
      const insp = await inspections.create(
        tx, tenantId, operatorId,
        { title, templateId: template.id, inspectorId, ...(scheduledAt !== null ? { scheduledAt } : {}) },
        ctx,
      );
      if (target === "scheduled") { scheduled++; return; }

      const started = await inspections.start(tx, tenantId, admin, operatorId, insp.id, insp.lockVersion, ctx);
      if (target === "in_progress") { running++; return; }

      const responses = answerSchema(template.schema, raiseNcr);
      await inspections.complete(tx, tenantId, admin, operatorId, insp.id, responses, started.lockVersion, ctx);
      completed++;

      // A failing pass_fail/yes_no answer is grounds for a finding → NCR chain.
      const failed = Object.entries(responses).find(([, v]) => v === "fail" || v === "no");
      if (failed === undefined) return;

      const [itemRef] = failed;
      const severity = pick(["minor", "major", "major", "critical"] as const);
      const finding = await findings.create(
        tx, tenantId, admin, operatorId, insp.id,
        { itemRef, severity, description: `${pick(NOTES)} (item ${itemRef})` },
        ctx,
      );
      const priority = severity === "minor" ? "minor" : severity === "critical" ? "critical" : "major";
      const ncr = await ncrs.create(
        tx, tenantId, admin, operatorId,
        { title: pick(NCR_TITLES), priority, findingId: finding.id },
        ctx,
      );
      ncrCount++;

      // Walk the NCR to a random depth: open → assigned → in_progress.
      // (resolved/closed are gated by four-eyes + completed CAPA + no open 8D,
      // so we stop short — an open 8D legitimately blocks resolve anyway.)
      const depth = Math.floor(rand() * 3); // 0 open, 1 assigned, 2 in_progress
      let version = ncr.lockVersion;
      const ownerId = pick(doers);
      if (depth >= 1) {
        const assigned = await ncrs.transition(tx, tenantId, admin, operatorId, ncr.id, { to: "assigned", ownerId, version }, ctx);
        version = assigned.lockVersion;
      }
      if (depth >= 2) {
        await ncrs.transition(tx, tenantId, admin, operatorId, ncr.id, { to: "in_progress", version }, ctx);
      }

      // Major/critical NCRs open an 8D, linked to the NCR, driven to a random
      // discipline with real payloads.
      if ((priority === "major" || priority === "critical") && chance(0.85)) {
        const lead = pick(doers);
        const members = pickN(allMembers.filter((m) => m !== lead), 3);
        let e8 = await eightDs.create(
          tx, tenantId, operatorId,
          {
            title: `${pick(NCR_TITLES)} — containment & root cause`,
            ncrId: ncr.id, teamLeadId: lead, championId: operatorId, memberIds: members,
            targetAt: new Date(Date.now() + 21 * 86400000).toISOString(),
          },
          ctx,
        );
        eightDCount++;
        const toStep = 1 + Math.floor(rand() * 4); // complete D1..D(toStep-1), leave D(toStep) in progress
        const step = async (num: number, status: "complete" | "in_progress", data: Record<string, unknown>): Promise<void> => {
          e8 = await eightDs.updateStep(tx, tenantId, operatorId, e8.id, num, { status, data, version: e8.lockVersion }, ctx);
        };
        const payloads: Record<number, Record<string, unknown>> = {
          1: { teamRoles: { [lead]: "Team Lead" }, ai: { model: "Kaenal Quality Copilot", draftedFrom: ncr.code } },
          2: { problemStatement: `${pick(NCR_TITLES)} observed on ${title}. Rate above IATF threshold; containment active.`, cost: Math.floor(rand() * 90000), quantity: Math.floor(rand() * 3000) },
          3: { actions: [{ title: "100% visual inspection at station", owner: pick(members), status: "completed" }], effective: true },
          4: { fiveWhys: [{ why: "Why did the defect occur?", answer: "Process parameter drifted out of spec." }] },
        };
        for (let d = 1; d <= toStep && d <= 4; d++) {
          await step(d, d < toStep ? "complete" : "in_progress", payloads[d] ?? {});
        }
      }
    });
  }

  console.log(`Seeded inspections — scheduled ${scheduled}, in-progress ${running}, completed ${completed}.`);
  console.log(`Seeded ${ncrCount} NCRs (chained from findings) and ${eightDCount} linked 8D investigations.`);
  console.log(`\nDone. Sign in at /sign-in (workspace: ${TENANT}).`);
  console.log(`  Operator admin: ${OPERATOR_EMAIL} / ${PASSWORD}`);
  console.log(`  Any seeded person: <first>.<last><n>@acme-qa.test / ${PASSWORD}  (pick roles from the members list)`);
  await control.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
