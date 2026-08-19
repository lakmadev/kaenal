-- ===========================================================================
-- 0036 — Device push tokens (Expo push registry).
--
-- Control-plane, because a device belongs to a PERSON, not a tenant: the same
-- phone receives push for every workspace the user belongs to (mirrors how the
-- email address + MFA secret live in `control`, 0035). A notification created in
-- any tenant is delivered to the user's registered devices, resolved here through
-- the control pool by `ChannelDelivery`.
--
-- `token` is globally UNIQUE: an Expo push token identifies one physical device,
-- so re-registering it (e.g. the device was handed to another user, or the user
-- switched accounts) REASSIGNS it via upsert rather than duplicating — the old
-- owner stops receiving push on that device, which is the correct, safe result.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS control.push_tokens (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id      uuid NOT NULL REFERENCES control.users (id) ON DELETE CASCADE,
  token        text NOT NULL,
  platform     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

-- Delivery always reads "the tokens for this user".
CREATE INDEX IF NOT EXISTS control_push_tokens_user_idx ON control.push_tokens (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON control.push_tokens TO kaenal_app;
