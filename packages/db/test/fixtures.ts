import type { Tx } from "../src/client.js";

/**
 * Seeds one row into every tenant-owned table, in FK order.
 *
 * The tenancy suite runs the same fixture for two tenants and then probes each
 * table generically, so every table needs at least one row to probe against.
 * `assertEveryTableSeeded` in rls.test.ts cross-checks this list against
 * pg_catalog — a new table with no fixture fails the suite rather than being
 * silently skipped, which is the whole point of enumerating dynamically.
 */
export async function seedTenant(tx: Tx, tenantId: string, tag: string): Promise<void> {
  const q = async (sql: string, params: unknown[] = []): Promise<string> => {
    const { rows } = await tx.query<{ id: string }>(sql, params);
    const id = rows[0]?.id;
    if (!id) throw new Error(`seed insert returned no id: ${sql.slice(0, 60)}`);
    return id;
  };

  const t = tenantId;

  // People live in control.users now (0003) — global identity, no tenant_id.
  // They become visible to this tenant only through a membership, which is
  // what every other table's composite FK actually references.
  const userId = await q(
    `INSERT INTO control.users (email, name) VALUES ($1, $2) RETURNING id`,
    [`user@${tag}.test`, `${tag} User`],
  );

  // A second person so four-eyes paths (resolver != verifier) are expressible.
  const verifierId = await q(
    `INSERT INTO control.users (email, name) VALUES ($1, $2) RETURNING id`,
    [`verifier@${tag}.test`, `${tag} Verifier`],
  );

  await q(
    `INSERT INTO memberships (tenant_id, user_id, role, status)
     VALUES ($1, $2, 'admin', 'active') RETURNING id`,
    [t, userId],
  );

  // Every user reference in a tenant table is a composite FK to
  // memberships(tenant_id, user_id), so the verifier needs one too.
  await q(
    `INSERT INTO memberships (tenant_id, user_id, role, status)
     VALUES ($1, $2, 'manager', 'active') RETURNING id`,
    [t, verifierId],
  );

  await q(
    `INSERT INTO invitations (tenant_id, email, role, token_hash, expires_at, invited_by)
     VALUES ($1, $2, 'inspector', $3, now() + interval '7 days', $4) RETURNING id`,
    [t, `invitee@${tag}.test`, `invite-hash-${tag}`, userId],
  );

  await q(
    `INSERT INTO sessions (tenant_id, user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '30 days') RETURNING id`,
    [t, userId, `hash-${tag}`],
  );

  const plantId = await q(
    `INSERT INTO plants (tenant_id, name, code) VALUES ($1, $2, $3) RETURNING id`,
    [t, `${tag} Plant`, `P-${tag}`],
  );

  const areaId = await q(
    `INSERT INTO areas (tenant_id, plant_id, name) VALUES ($1, $2, 'Weld Cell 3') RETURNING id`,
    [t, plantId],
  );

  const templateId = await q(
    `INSERT INTO inspection_templates (tenant_id, name, version, status, schema)
     VALUES ($1, $2, 1, 'published', '{"sections":[]}'::jsonb) RETURNING id`,
    [t, `${tag} Template`],
  );

  const inspectionId = await q(
    `INSERT INTO inspections (tenant_id, code, title, template_id, template_version,
                              inspector_id, plant_id, area_id, status)
     VALUES ($1, $2, 'Line walk', $3, 1, $4, $5, $6, 'completed') RETURNING id`,
    [t, `INS-${tag}-0001`, templateId, userId, plantId, areaId],
  );

  const ncrId = await q(
    `INSERT INTO ncrs (tenant_id, code, title, source, priority, status, owner_id, plant_id)
     VALUES ($1, $2, 'Weld porosity', 'inspection', 'major', 'open', $3, $4) RETURNING id`,
    [t, `NCR-${tag}-0001`, userId, plantId],
  );

  const findingId = await q(
    `INSERT INTO findings (tenant_id, inspection_id, item_ref, severity, description, ncr_id)
     VALUES ($1, $2, 'i1', 'major', 'Porosity on bead', $3) RETURNING id`,
    [t, inspectionId, ncrId],
  );

  await q(
    `INSERT INTO ncr_actions (tenant_id, ncr_id, kind, description, owner_id, status)
     VALUES ($1, $2, 'corrective', 'Requalify weld parameters', $3, 'pending') RETURNING id`,
    [t, ncrId, userId],
  );

  await q(
    `INSERT INTO eight_ds (tenant_id, code, title, ncr_id, team_lead_id, champion_id, current_step)
     VALUES ($1, $2, 'Porosity 8D', $3, $4, $5, 1) RETURNING id`,
    [t, `8D-${tag}-0001`, ncrId, userId, verifierId],
  );

  const capaId = await q(
    `INSERT INTO capas (tenant_id, code, title, type, priority, owner_id, status)
     VALUES ($1, $2, 'Weld process CAPA', 'corrective', 'major', $3, 'initiation') RETURNING id`,
    [t, `CAPA-${tag}-0001`, userId],
  );

  await q(
    `INSERT INTO capa_actions (tenant_id, capa_id, description, owner_id, status)
     VALUES ($1, $2, 'Update WI-204', $3, 'pending') RETURNING id`,
    [t, capaId, userId],
  );

  const auditId = await q(
    `INSERT INTO audits (tenant_id, code, title, standard, type, status, lead_auditor_id, plant_id)
     VALUES ($1, $2, 'Internal IATF audit', 'IATF 16949', 'internal', 'planned', $3, $4) RETURNING id`,
    [t, `AUD-${tag}-0001`, userId, plantId],
  );

  await q(
    `INSERT INTO audit_findings (tenant_id, audit_id, clause, kind, description, ncr_id, capa_id)
     VALUES ($1, $2, '8.5.1', 'minor_nc', 'Control plan not current', $3, $4) RETURNING id`,
    [t, auditId, ncrId, capaId],
  );

  const fileId = await q(
    `INSERT INTO files (tenant_id, bucket, key, filename, mime, size_bytes, sha256,
                        uploaded_by, scan_status)
     VALUES ($1, 'kaenal-local', $2, 'evidence.jpg', 'image/jpeg', 12345, $3, $4, 'clean')
     RETURNING id`,
    [t, `${tag}/evidence.jpg`, `sha-${tag}`, userId],
  );

  const documentId = await q(
    `INSERT INTO documents (tenant_id, code, title, category, status, version, file_id, owner_id)
     VALUES ($1, $2, 'Welding Work Instruction', 'work_instruction', 'approved', '1.0', $3, $4)
     RETURNING id`,
    [t, `DOC-${tag}-0001`, fileId, userId],
  );

  await q(
    `INSERT INTO document_versions (tenant_id, document_id, version, file_id, changelog, approved_by)
     VALUES ($1, $2, '1.0', $3, 'Initial release', $4) RETURNING id`,
    [t, documentId, fileId, userId],
  );

  const supplierId = await q(
    `INSERT INTO suppliers (tenant_id, name, code, status) VALUES ($1, $2, $3, 'active') RETURNING id`,
    [t, `${tag} Supplier`, `SUP-${tag}`],
  );

  await q(
    `INSERT INTO ppap_submissions (tenant_id, supplier_id, part_number, level, status)
     VALUES ($1, $2, 'PN-1001', 3, 'in_review') RETURNING id`,
    [t, supplierId],
  );

  await q(
    `INSERT INTO scars (tenant_id, code, supplier_id, ncr_id, status)
     VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
    [t, `SCAR-${tag}-0001`, supplierId, ncrId],
  );

  await q(
    `INSERT INTO notifications (tenant_id, user_id, kind, title, entity_kind, entity_id)
     VALUES ($1, $2, 'ncr_assigned', 'NCR assigned to you', 'ncr', $3) RETURNING id`,
    [t, userId, ncrId],
  );

  await q(
    `INSERT INTO notification_prefs (tenant_id, user_id, matrix)
     VALUES ($1, $2, '{"ncr_assigned":{"inapp":true,"email":true}}'::jsonb) RETURNING id`,
    [t, userId],
  );

  await q(`INSERT INTO user_preferences (tenant_id, user_id) VALUES ($1, $2) RETURNING id`, [t, userId]);

  await q(
    `INSERT INTO entity_people (tenant_id, entity_kind, entity_id, user_id, role)
     VALUES ($1, 'ncr', $2, $3, 'owner') RETURNING id`,
    [t, ncrId, userId],
  );

  await q(
    `INSERT INTO comments (tenant_id, entity_kind, entity_id, author_id, body)
     VALUES ($1, 'ncr', $2, $3, 'Containment applied on shift 2.') RETURNING id`,
    [t, ncrId, userId],
  );

  await q(
    `INSERT INTO exports (tenant_id, resource, format, status, requested_by)
     VALUES ($1, 'ncrs', 'csv', 'queued', $2) RETURNING id`,
    [t, userId],
  );

  await q(
    `INSERT INTO entity_links (tenant_id, from_kind, from_id, to_kind, to_id, relation, created_by)
     VALUES ($1, 'document', $2, 'ncr', $3, 'reference', $4) RETURNING id`,
    [t, documentId, ncrId, userId],
  );

  // Sprint 03 G1 — `finding` on both sides of an edge (RLS suite must cover
  // this new kind specifically, not just the pre-existing document->ncr row).
  await q(
    `INSERT INTO entity_links (tenant_id, from_kind, from_id, to_kind, to_id, relation, created_by)
     VALUES ($1, 'inspection', $2, 'finding', $3, 'linked', $4) RETURNING id`,
    [t, inspectionId, findingId, userId],
  );
  await q(
    `INSERT INTO entity_links (tenant_id, from_kind, from_id, to_kind, to_id, relation, created_by)
     VALUES ($1, 'finding', $2, 'ncr', $3, 'linked', $4) RETURNING id`,
    [t, findingId, ncrId, userId],
  );

  await q(
    `INSERT INTO counters (tenant_id, kind, year, value) VALUES ($1, 'ncr', 2026, 1) RETURNING id`,
    [t],
  );

  await q(
    `INSERT INTO sla_configs (tenant_id, entity_kind, priority, respond_hours, resolve_hours,
                              escalate_to_role)
     VALUES ($1, 'ncr', 'critical', 4, 24, 'admin')
     ON CONFLICT (tenant_id, entity_kind, priority) DO UPDATE SET respond_hours = 4
     RETURNING id`,
    [t],
  );

  await q(
    `INSERT INTO entitlements (tenant_id, pack_id, active) VALUES ($1, 'supplier_quality', true)
     RETURNING id`,
    [t],
  );

  await q(
    `INSERT INTO api_keys (tenant_id, name, hash, prefix, scopes)
     VALUES ($1, 'CI key', $2, $3, ARRAY['read:ncr']) RETURNING id`,
    [t, `keyhash-${tag}`, `knl_${tag}`],
  );

  await q(
    `INSERT INTO webhook_endpoints (tenant_id, url, secret, events)
     VALUES ($1, $2, $3, ARRAY['ncr.created']) RETURNING id`,
    [t, `https://${tag}.example.test/hook`, `whsec-${tag}`],
  );

  await q(
    `INSERT INTO signatures (tenant_id, entity_kind, entity_id, signer_id, meaning,
                             auth_method, content_sha256)
     VALUES ($1, 'inspection', $2, $3, 'performed', 'password', $4) RETURNING id`,
    [t, inspectionId, userId, `contenthash-${tag}`],
  );

  await q(
    `INSERT INTO legal_holds (tenant_id, scope, reason)
     VALUES ($1, '{"entityKind":"ncr"}'::jsonb, 'Customer litigation') RETURNING id`,
    [t],
  );

  await q(
    `INSERT INTO ai_settings (tenant_id, allow_ai) VALUES ($1, true) RETURNING id`,
    [t],
  );

  await q(
    `INSERT INTO ai_budgets (tenant_id, period, token_limit, tokens_used)
     VALUES ($1, date_trunc('month', now())::date, 1000000, 0) RETURNING id`,
    [t],
  );

  await q(
    `INSERT INTO ai_invocations (tenant_id, user_id, feature, model, status,
                                 input_tokens, output_tokens, redactions_applied)
     VALUES ($1, $2, 'doc_summary', 'fast', 'succeeded', 120, 80, 1) RETURNING id`,
    [t, userId],
  );

  // ── Admin-config + data-platform tables (Phases A–K). Seeded here so the
  // tenancy suite proves isolation on every tenant table, not just the core QMS
  // set — each needs at least one row to probe against. FK order matters:
  // parents (fmeas, integrations, import_profiles) before their children.

  // Phase A — white-label settings. Composite PK (tenant_id, namespace), no
  // `id` column, so it can't use the id-returning `q()` helper.
  await tx.query(
    `INSERT INTO tenant_settings (tenant_id, namespace, doc)
     VALUES ($1, 'branding', '{"brandName":"Acme"}'::jsonb)`,
    [t],
  );

  // Phase B — NCR validation rules.
  await q(
    `INSERT INTO ncr_validation_rules (tenant_id, name, field, operator, action, message)
     VALUES ($1, 'Require title', 'title', 'is_not_empty', 'block', 'Title is required')
     RETURNING id`,
    [t],
  );

  // Phase D — DLP policies.
  await q(
    `INSERT INTO dlp_policies (tenant_id, name, action) VALUES ($1, 'Block SSNs', 'block')
     RETURNING id`,
    [t],
  );

  // Phase E — cost centers.
  await q(
    `INSERT INTO cost_centers (tenant_id, code, name) VALUES ($1, $2, 'Quality Dept')
     RETURNING id`,
    [t, `CC-${tag}`],
  );

  // Phase F — FMEA header + one item.
  const fmeaId = await q(
    `INSERT INTO fmeas (tenant_id, part_code, part_name) VALUES ($1, $2, 'Bracket')
     RETURNING id`,
    [t, `PART-${tag}`],
  );
  await q(
    `INSERT INTO fmea_items (tenant_id, fmea_id, failure_mode)
     VALUES ($1, $2, 'Crack under cyclic load') RETURNING id`,
    [t, fmeaId],
  );

  // Phase H — report definitions.
  await q(
    `INSERT INTO report_definitions (tenant_id, name, definition)
     VALUES ($1, 'Open NCRs by plant', '{"tiles":[]}'::jsonb) RETURNING id`,
    [t],
  );

  // Phase I — integration registry + one event.
  const integrationId = await q(
    `INSERT INTO integrations (tenant_id, provider, name) VALUES ($1, 'rest', 'Warehouse REST')
     RETURNING id`,
    [t],
  );
  await q(
    `INSERT INTO integration_events (tenant_id, integration_id, direction, kind)
     VALUES ($1, $2, 'out', 'sync') RETURNING id`,
    [t, integrationId],
  );

  // Phase J — import profile + run.
  const importProfileId = await q(
    `INSERT INTO import_profiles (tenant_id, name, target_entity)
     VALUES ($1, 'Supplier CSV', 'suppliers') RETURNING id`,
    [t],
  );
  await q(
    `INSERT INTO import_runs (tenant_id, profile_id, target_entity)
     VALUES ($1, $2, 'suppliers') RETURNING id`,
    [t, importProfileId],
  );

  // Phase K — SPC measurements.
  await q(
    `INSERT INTO measurements (tenant_id, part, characteristic, value, subgroup)
     VALUES ($1, 'Bracket', 'hole_dia_mm', 10.02, 1) RETURNING id`,
    [t],
  );

  await q(
    `INSERT INTO audit_events (tenant_id, actor_id, actor_kind, entity_kind, entity_id,
                               action, after)
     VALUES ($1, $2, 'user', 'ncr', $3, 'created', '{"status":"open"}'::jsonb) RETURNING id`,
    [t, userId, ncrId],
  );

  // M26 — device sync-health telemetry (composite PK, no `id` → raw insert). The
  // row is scoped to a seeded member so the tenancy suite can probe its RLS.
  await tx.query(
    `INSERT INTO device_sync_status (tenant_id, user_id, device_id, failed, needs_review)
     VALUES ($1, $2, $3, 0, 0)`,
    [t, userId, `dev-${tag}`],
  );

  // Transactional outbox (0041). A pending event carrying an entity's identity
  // (never row data), scoped to the seeded NCR + admin member so the tenancy
  // suite can probe its RLS like every other mutable table.
  await q(
    `INSERT INTO outbox (tenant_id, event_type, entity_kind, entity_id, action, actor_id, actor_kind, payload)
     VALUES ($1, 'ncr.created', 'ncr', $2::uuid, 'created', $3, 'user',
             jsonb_build_object('entityId', $2, 'at', now()))
     RETURNING id`,
    [t, ncrId, userId],
  );

  // Sprint 03 Part B — predictive risk (0062). One nightly-job-shaped row for
  // the seeded area ("line"), scoped to the seeded admin member as the actor.
  await q(
    `INSERT INTO risk_predictions
       (tenant_id, subject_kind, subject_id, horizon, predicted_value, confidence,
        band_low, band_high, history, reasoning, model_version, generated_at, created_by)
     VALUES ($1, 'line', $2, '2026-Q4', 5, 62, 2, 8,
             ARRAY[1,2,2,3,4,4]::numeric[], 'NC count rose 1→4 over 6 periods',
             'nc-forecast-v1-baseline', now(), $3)
     RETURNING id`,
    [t, areaId, userId],
  );

  // Sprint 04 Slice 1 — risk register (0064): one risk + one control, owned
  // by the seeded admin member.
  const riskId = await q(
    `INSERT INTO risks (tenant_id, code, category, title, owner, likelihood, impact,
                        residual_score, trend, treatment, status)
     VALUES ($1, $2, 'process', 'Weld cell single point of failure', $3, 4, 4, 12,
             'flat', 'mitigate', 'active') RETURNING id`,
    [t, `RISK-${tag}-0001`, userId],
  );
  await q(
    `INSERT INTO risk_controls (tenant_id, risk_id, kind, description, strength, seq)
     VALUES ($1, $2, 'preventive', 'Preventive maintenance schedule on weld cell', 'medium', 1)
     RETURNING id`,
    [t, riskId],
  );

  // Sprint 04 Slice 1 — MSA / Gauge R&R (0065): one draft study + one grid cell.
  const msaStudyId = await q(
    `INSERT INTO msa_studies (tenant_id, code, characteristic, gauge_label, method,
                              n_appraisers, n_parts, n_trials, tolerance, status, owner)
     VALUES ($1, $2, 'Bore diameter', 'Zeiss Contura', 'crossed_anova', 3, 10, 3, 0.05,
             'draft', $3) RETURNING id`,
    [t, `MSA-${tag}-0001`, userId],
  );
  await q(
    `INSERT INTO msa_measurements (tenant_id, study_id, appraiser, part, trial, value)
     VALUES ($1, $2, 1, 1, 1, 10.02) RETURNING id`,
    [t, msaStudyId],
  );

  // Sprint 05 Slice 2 — calibration (0068): one active instrument, owned by
  // the seeded admin member, plus one `pass` calibration event certified by
  // the seeded evidence file (exercises certificate_file_id's composite FK).
  const instrumentId = await q(
    `INSERT INTO instruments (tenant_id, code, name, type, plant_id, area_id, method,
                              tolerance, interval_months, last_calibrated, owner, status)
     VALUES ($1, $2, 'CMM #1', 'cmm', $3, $4, 'Internal — ISO 10360', '±1.7μm', 12,
             '2026-01-15', $5, 'active') RETURNING id`,
    [t, `CAL-${tag}-0001`, plantId, areaId, userId],
  );
  await q(
    `INSERT INTO calibration_events (tenant_id, instrument_id, performed_at, result,
                                     performed_by, notes, certificate_file_id)
     VALUES ($1, $2, '2026-01-15', 'pass', 'A2LA Cal Labs', 'Within tolerance', $3)
     RETURNING id`,
    [t, instrumentId, fileId],
  );

  // Sprint 05 Slice 2 — training (0069): one non-archived mandatory
  // competency plus one completed, non-expiring training record for the
  // seeded admin member.
  const competencyId = await q(
    `INSERT INTO competencies (tenant_id, code, name, mandatory, valid_months, seq)
     VALUES ($1, $2, 'IATF 16949 Awareness', true, 24, 1) RETURNING id`,
    [t, `iatf-${tag}`],
  );
  await q(
    `INSERT INTO training_records (tenant_id, member_id, competency_id, completed_at, valid_months)
     VALUES ($1, $2, $3, '2026-01-10', 24) RETURNING id`,
    [t, userId, competencyId],
  );

  // Sprint 06 — customer complaints (0071): one triage complaint owned by the
  // seeded admin member, with SLA targets denormalized as they would be at
  // creation, plus one attachment linking it to the seeded evidence file
  // (exercises complaint_attachments' composite FK on both sides).
  const complaintId = await q(
    `INSERT INTO complaints (tenant_id, code, customer, contact, channel, severity, subject,
                             sla_target_hours, sla_close_target_days, owner)
     VALUES ($1, $2, 'Acme Corp', 'Magnus Eriksson · Quality Manager', 'portal', 'high',
             'Bracket cracking in the field', 4, 21, $3) RETURNING id`,
    [t, `COM-${tag}-0001`, userId],
  );
  await q(
    `INSERT INTO complaint_attachments (tenant_id, complaint_id, file_id, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [t, complaintId, fileId, userId],
  );

  // Sprint 06 — ECN (0072): one draft ECN owned by the seeded admin member,
  // plus its 5 pre-created (pending) gated-stage approval rows (E4 AC1).
  const ecnId = await q(
    `INSERT INTO ecns (tenant_id, code, title, change_type, change_risk, owner)
     VALUES ($1, $2, 'Swap bushing supplier', 'material', 'medium', $3) RETURNING id`,
    [t, `ECN-${tag}-0001`, userId],
  );
  for (const stage of ["feasibility", "risk_review", "ppap", "cab_approval", "pilot"]) {
    await q(
      `INSERT INTO ecn_approvals (tenant_id, ecn_id, stage) VALUES ($1, $2, $3) RETURNING id`,
      [t, ecnId, stage],
    );
  }
}

/**
 * Test teardown. TRUNCATE rather than DELETE because audit_events is
 * append-only by design — the app role has no DELETE privilege and a trigger
 * blocks it — so the only way to reset it is as the owner via TRUNCATE, which
 * bypasses row triggers and RLS. CASCADE sorts out FK order for us.
 *
 * Runs as the migrator, and only ever against the test database.
 */
export async function truncateAllTenantTables(tx: Tx, tables: readonly string[]): Promise<void> {
  if (tables.length === 0) return;
  // control.users goes too: it is not tenant-owned, so it survives a
  // tenant-table truncate, and its email is globally unique — re-seeding
  // would collide on the second run rather than starting clean. Only the
  // identity tables; control.tenants is the registry and must persist.
  await tx.query(
    `TRUNCATE TABLE ${tables.map((t) => `public.${t}`).join(", ")}, control.users CASCADE`,
  );
}
