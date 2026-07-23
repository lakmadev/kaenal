-- 0014_ai.sql
--
-- AI gateway persistence (06 §3). Three tenant-owned tables behind the single
-- gateway chokepoint — no other code path may write them:
--
--   ai_settings     — per-tenant data controls (06 §3.3): the `allow_ai` kill
--                     switch, cross-entity-context gate, PII-redaction toggle,
--                     and residency lock. One row per tenant.
--   ai_budgets      — per-tenant monthly token budget (06 §3.1); over budget the
--                     gateway refuses ("AI credits exhausted"). One row per period.
--   ai_invocations  — the AI audit trail + cost ledger (06 §3.5): every call,
--                     its feature/model, token spend, entity refs, latency, and
--                     redaction count — powering the "AI audit trail" and
--                     "Cost & budgets" tabs (FEATURES §16.1).
--
-- The `intelligence` entitlement pack (existing `entitlements` table) gates
-- access to every feature; these tables assume it and add the finer controls.

-- --- Data controls ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_settings (
  id                         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id                  uuid NOT NULL,
  allow_ai                   boolean NOT NULL DEFAULT true,
  allow_cross_entity_context boolean NOT NULL DEFAULT false,
  pii_redaction              boolean NOT NULL DEFAULT true,
  region_lock                text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  created_by                 uuid,
  updated_by                 uuid
);
-- One settings row per tenant; the unique index is also the leading-tenant index (rule 2).
CREATE UNIQUE INDEX IF NOT EXISTS ai_settings_tenant_uq ON ai_settings (tenant_id);

-- --- Token budget -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_budgets (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  period      date NOT NULL,                    -- first day of the budget month (UTC)
  token_limit bigint NOT NULL CHECK (token_limit >= 0),
  tokens_used bigint NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_budgets_tenant_period_uq ON ai_budgets (tenant_id, period);

-- --- Invocation ledger ------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_invocations (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL,
  user_id            uuid,                       -- null = system-initiated
  feature            text NOT NULL
                       CHECK (feature IN ('doc_summary','quicklog_structuring','root_cause',
                                          'eightd_draft','compliance_qa','report_narrative')),
  model              text NOT NULL,
  status             text NOT NULL
                       CHECK (status IN ('succeeded','failed','blocked')),
  block_reason       text CHECK (block_reason IN ('entitlement','ai_disabled','region','budget')),
  input_tokens       int NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens      int NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  entity_refs        jsonb NOT NULL DEFAULT '[]'::jsonb,
  latency_ms         int CHECK (latency_ms IS NULL OR latency_ms >= 0),
  redactions_applied int NOT NULL DEFAULT 0 CHECK (redactions_applied >= 0),
  error              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
-- Leading tenant_id index (rule 2); the ledger is browsed newest-first.
CREATE INDEX IF NOT EXISTS ai_invocations_tenant_created_idx ON ai_invocations (tenant_id, created_at DESC);

-- Composite member FK on the actor: (tenant_id, user_id) -> memberships (02 §2,
-- shared-identity decision). Nullable user_id (system calls) is exempt by MATCH SIMPLE.
ALTER TABLE ai_invocations DROP CONSTRAINT IF EXISTS ai_invocations_user_member_fk;
ALTER TABLE ai_invocations ADD CONSTRAINT ai_invocations_user_member_fk
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- Tenant isolation (02 §1). check-rls.ts enumerates tenant tables dynamically,
-- so each is in scope by default and would fail CI without the policy.
SELECT apply_tenant_rls('ai_settings');
SELECT apply_tenant_rls('ai_budgets');
SELECT apply_tenant_rls('ai_invocations');
