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

  await q(
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
     VALUES ($1, $2, 'PN-1001', 3, 'submitted') RETURNING id`,
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

  await q(
    `INSERT INTO audit_events (tenant_id, actor_id, actor_kind, entity_kind, entity_id,
                               action, after)
     VALUES ($1, $2, 'user', 'ncr', $3, 'created', '{"status":"open"}'::jsonb) RETURNING id`,
    [t, userId, ncrId],
  );
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
