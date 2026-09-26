-- ===========================================================================
-- 0051 — Per-user appearance/interaction preferences (Sprint 01 S1-9, S1-7).
--
-- One row per member per tenant (self-scoped: the service filters user_id =
-- actor on top of RLS). Typed columns rather than JSONB so every value is
-- CHECK-constrained from the same lists as packages/types. A missing row means
-- "defaults"; the first save INSERTs at lock_version = 1 (optimistic, rule 6).
-- The user reference is a composite FK to memberships (settled decision).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL,
  user_id              uuid NOT NULL,
  ai_prominence        text NOT NULL DEFAULT 'normal' CHECK (ai_prominence IN ('front','normal','quiet')),
  accent               text NOT NULL DEFAULT 'ink' CHECK (accent IN ('ink','indigo','teal','orange')),
  density              text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact')),
  keyboard_shortcuts   boolean NOT NULL DEFAULT true,
  show_keyboard_hints  boolean NOT NULL DEFAULT true,
  locale               text NOT NULL DEFAULT 'en' CHECK (locale IN ('en')),
  lock_version         int NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid,
  updated_by           uuid
);

-- Leading-tenant_id unique index (rule 2): one row per member.
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_tenant_user_uq ON user_preferences (tenant_id, user_id);

DROP TRIGGER IF EXISTS user_preferences_bump_lock_version ON user_preferences;
CREATE TRIGGER user_preferences_bump_lock_version BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_member_fk;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_member_fk
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;

SELECT apply_tenant_rls('user_preferences');
