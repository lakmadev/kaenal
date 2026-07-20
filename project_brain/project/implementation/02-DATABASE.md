# 02 — Database (Postgres 16 + Drizzle)

## 1. Roles & RLS foundation
Three DB roles:
- `kaenal_app` — the API's role. **NOT** table owner, **NOT** `BYPASSRLS`. All tenant tables have RLS enabled + FORCED.
- `kaenal_migrator` — owner; runs migrations only.
- `kaenal_public` — public/unauthenticated routes; has access ONLY to `control` schema lookups it needs (none by default).

Canonical RLS pattern — apply to EVERY tenant-owned table:
```sql
ALTER TABLE ncrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncrs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ncrs
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```
Notes:
- `current_setting('app.tenant_id')` with no second arg → **throws** if unset. That is intentional: a query outside a tenant-scoped transaction must fail loudly, not return everything. (Do NOT use `current_setting(..., true)` which returns NULL and silently filters to nothing.)
- `WITH CHECK` blocks inserting/updating rows into another tenant.
- Every insert still sets `tenant_id` explicitly from the request context (defense in depth); a `BEFORE INSERT` trigger `set_tenant_id()` fills it from the setting if the app forgot.
- Composite indexes must lead with `tenant_id`: `(tenant_id, status)`, `(tenant_id, due_at)`, `(tenant_id, created_at desc)`. A query planner that can't use tenant-led indexes will seq-scan the whole shared table.

## 2. Core schema (tables + key columns)
All tables get: `id uuid pk default uuidv7()`, `tenant_id uuid not null`, `created_at/updated_at timestamptz not null default now()`, `created_by/updated_by uuid`, `deleted_at timestamptz null` (where soft-deletable). Below only domain columns are listed. Enum values MUST match `packages/types` exactly.

```
users(id, email citext unique-per-tenant, name, title, avatar_url, locale, timezone, status: active|invited|deactivated)
memberships(user_id, tenant_id, role: admin|manager|auditor|inspector|viewer, plant_ids uuid[], unique(user_id, tenant_id))
plants(name, code, address, timezone)            -- a.k.a. sites
areas(plant_id fk, name)                          -- e.g. "Weld Cell 3"

inspection_templates(name, version int, status: draft|published|archived, schema jsonb, usage_count)
  -- schema jsonb = the dynamic form definition (sections[] → items[]; item types: pass_fail, yes_no,
  -- score, text, textarea, number, select, multiselect, date, datetime, photo, signature, header, info;
  -- per-item: required, weight, conditional {itemId, op, value}, finding_trigger {on, severity})
  -- Publishing creates a NEW immutable row (version+1). In-flight inspections keep their version. NEVER mutate a published schema.
inspections(code, title, template_id fk + template_version, inspector_id, plant_id, area_id,
  status: scheduled|in_progress|completed|cancelled, risk: low|medium|high|critical|null,
  scheduled_at, started_at, completed_at, score numeric null, responses jsonb, signature_file_id null,
  recurrence jsonb null)  -- {freq: daily|weekly|monthly, interval, byweekday[], until}
findings(inspection_id fk, item_ref text, severity: minor|major|critical, description, ncr_id fk null)

ncrs(code, title, description, source: inspection|manual|complaint|audit, source_id uuid null,
  priority: minor|major|critical, risk, category, status: draft|open|assigned|in_progress|resolved|verified|closed|escalated|reopened,
  owner_id, plant_id, area_id null, due_at, sla_state: on_track|at_risk|breached, eight_d_id null,
  impact jsonb null)  -- {defect_rate, parts_quarantined, cost_minor_units, currency, regulatory_note}
ncr_actions(ncr_id fk, kind: containment|corrective|preventive, description, owner_id, due_at,
  status: pending|in_progress|done|verified, verified_by null, verified_at null)

eight_ds(code, title, ncr_id fk null, status: active|completed|cancelled, team_lead_id, champion_id,
  member_ids uuid[], started_at, target_at, current_step int 1..8, steps jsonb)
  -- steps jsonb: {d1:{...}, d2:{statement, is_isnot:{...}}, d3:{actions[]}, d4:{methods[], root_cause, verified},
  --  d5:{actions[], decision_matrix}, d6:{tasks[], validation}, d7:{systemic[], horizontal[]}, d8:{lessons, signoffs[]}}
  -- Each step object has status: pending|in_progress|complete and completed_at/completed_by.
  -- Rule: step N can only be marked complete if steps 1..N-1 are complete (D3 may run parallel to D2).

audits(code, title, standard, type: internal|certification|supplier|process, status/phase: planned|preparation|fieldwork|reporting|closed,
  lead_auditor_id, team uuid[], plant_id, start_at, end_at, checklist jsonb, progress numeric)
audit_findings(audit_id fk, clause text, kind: major_nc|minor_nc|opportunity, description, ncr_id null, capa_id null)

capas(code, title, description, type: corrective|preventive, priority, risk, owner_id, sponsor_id,
  status/phase: initiation|root_cause|action_plan|implementation|verification|effectiveness|closed,
  source_kind text null, source_id uuid null, due_at, effectiveness_check_at)
capa_actions(capa_id fk, description, owner_id, due_at, status)

documents(code, title, category: manual|sop|work_instruction|form|record|audit_report|supplier|training,
  status: draft|pending|approved|rejected|archived, version text, file_id fk, owner_id, approver_id,
  expires_at null, frameworks text[], ai_summary text null)
document_versions(document_id fk, version, file_id, changelog, approved_by, approved_at)

files(bucket, key, filename, mime, size_bytes, sha256, uploaded_by, scan_status: pending|clean|infected,
  entity_kind text null, entity_id uuid null)  -- see 07 for integrity rules

suppliers(name, code, tier, status, risk_tier, contact jsonb, scorecard jsonb)  -- scorecard: {ppm, otd, oqe, scar_count} raw metrics; weighted score computed in packages/core
ppap_submissions(supplier_id fk, part_number, level 1..5, status: draft|submitted|interim|approved|rejected, elements jsonb)
scars(code, supplier_id fk, ncr_id null, status, chargeback jsonb null)

notifications(user_id, kind, title, body, entity_kind, entity_id, read_at null, channels_sent text[])
notification_prefs(user_id, matrix jsonb)  -- {ncr_assigned: {inapp,email,push,sms}, ...}
comments(entity_kind, entity_id, author_id, body, parent_id null)
counters(tenant_id, kind text, year int, value int, unique(tenant_id, kind, year))
sla_configs(entity_kind, priority, respond_hours, resolve_hours, escalate_to_role, business_hours jsonb)
entitlements(pack_id text, active bool, activated_at, unique(tenant_id, pack_id))  -- mirrors src/addons.jsx packs
api_keys(name, hash, prefix, scopes text[], last_used_at, revoked_at)  -- store SHA-256 hash only
webhook_endpoints(url, secret, events text[], status, failure_count)
```

## 3. Audit trail (append-only)
```sql
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL,
  actor_id uuid,                  -- null = system/job
  actor_kind text NOT NULL CHECK (actor_kind IN ('user','system','api_key','support')),
  entity_kind text NOT NULL, entity_id uuid NOT NULL,
  action text NOT NULL,           -- created|updated|status_changed|assigned|commented|file_attached|signed|exported|deleted ...
  before jsonb, after jsonb,      -- ONLY changed fields, not whole rows; redact secrets
  reason text,                    -- required for support-role actions and overrides
  request_id uuid, ip inet, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Immutability: RLS same as others, PLUS:
REVOKE UPDATE, DELETE ON audit_events FROM kaenal_app;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION raise_exception('audit_events is append-only');
```
Writing: a `withAudit(tx, events[])` helper in `packages/db` — every service mutation composes it **inside the same transaction** so a rollback removes both. Index `(tenant_id, entity_kind, entity_id, created_at desc)`. Partition by month once > 50M rows.

## 4. Status state machines (enforce in `packages/core`, mirror with DB check constraints where cheap)
- **NCR:** draft→open→assigned→in_progress→resolved→verified→closed; any active→escalated (auto or manual); closed→reopened→in_progress. Illegal transitions rejected with `409 INVALID_TRANSITION` listing allowed next states. Resolving requires ≥1 corrective action `done`; verifying requires verifier ≠ resolver (four-eyes).
- **Inspection:** scheduled→in_progress→completed; scheduled/in_progress→cancelled. Completing requires all `required` items answered (validated against the template schema server-side, not just in UI).
- **CAPA phases** advance only forward except an explicit `revert` action (audited, reason required).
- **Document:** draft→pending→approved|rejected; approved→archived. New version resets to draft as a new `document_versions` row.

## 5. Migrations
Drizzle Kit, SQL migrations committed to `packages/db/migrations`. Rules: expand→migrate→contract (never drop/rename a column in the same release that stops writing it); every migration idempotent-safe (`IF NOT EXISTS`); RLS policy + indexes created in the SAME migration as the table; destructive migrations require a `-- @destructive` marker that CI flags for manual approval. Model B (dedicated) instances: a fan-out script iterates the registry and applies migrations with per-tenant locking; a failed tenant halts its own rollout, not others'.

## 6. CI schema lint (`packages/db/scripts/check-rls.ts`)
Query `pg_tables` + `pg_policies` in the test database after migrating; fail CI if any table (outside `control` and explicitly whitelisted lookup tables) is missing: `tenant_id` column, `rowsecurity=true`, forced RLS, a `tenant_isolation` policy, or a leading-`tenant_id` index.

## 7. Edge cases (database layer)
- **Counters race:** two simultaneous NCR creates must not duplicate `NCR-2026-0142` → `INSERT ... ON CONFLICT ... DO UPDATE SET value = counters.value + 1 RETURNING value` (row-lock serializes).
- **Year rollover:** counter key includes year; first create in January starts at 1. Codes are never recycled even if the row is deleted.
- **Template edited mid-inspection:** impossible by design (immutable versions) — enforce with a trigger rejecting UPDATE of `schema` when `status='published'`.
- **User deactivated with open items:** block deactivation until items are reassigned (API returns the list), OR force-reassign to their manager with audit events. Never orphan an owner_id.
- **Clock skew from mobile:** server timestamps are authoritative; client-supplied `performed_at` stored separately as `client_recorded_at`.
- **JSONB bloat:** `responses`/`steps` jsonb can reach MBs with base64 — NEVER store file bytes in jsonb; only `file_id` refs.
- **Cascade rules:** deleting (soft) an inspection does NOT delete NCRs created from it; the link stays, source shows "(deleted)". FKs are `ON DELETE RESTRICT` everywhere; soft delete is the only user-facing delete.
