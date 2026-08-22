-- ===========================================================================
-- 0041_outbox — transactional outbox (09 §1; the Kafka-alternative for reliable
-- event delivery decided in the CTO memo).
--
-- The problem it solves: a mutation that must ALSO tell the outside world (a
-- webhook, a downstream consumer) has two writes — the business row and the
-- "send event" — that a naive design does in two systems (Postgres + a broker)
-- with no shared transaction, so a crash between them either loses the event or
-- sends one for a change that rolled back. The outbox collapses both into ONE
-- Postgres transaction: the event row is written in the SAME tx as the mutation
-- and its audit event (rule 3), so it commits if and only if the change does. A
-- separate drainer then delivers pending rows at-least-once and marks them,
-- retrying with backoff — delivery can lag or fail without ever losing an event.
--
-- Pointer, not payload (same discipline as the realtime bus): the row carries
-- the event's IDENTITY (type / entity / action / actor), never business data, so
-- the outbox is not a second copy of tenant records and a consumer refetches
-- through the RLS-scoped API. `payload` holds only that envelope.
--
-- A normal tenant-scoped, mutable table (the drainer UPDATEs status), so it gets
-- the full isolation contract via apply_tenant_rls: tenant_id NOT NULL, forced
-- RLS + tenant_isolation policy, and a leading-tenant_id index. Not append-only
-- (unlike audit_events) — the app role needs UPDATE, which apply_tenant_rls
-- grants.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS outbox (
  -- uuidv7 so the primary key is itself time-ordered: the drainer processes
  -- events in roughly the order they were produced without a separate sequence.
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  -- Public event name, e.g. 'ncr.created' / 'capa.updated' — the contract a
  -- webhook consumer subscribes to. Derived in the app from the audit event.
  event_type   text NOT NULL,
  entity_kind  text NOT NULL,
  entity_id    uuid NOT NULL,
  action       text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  -- Who caused it. Deliberately a plain nullable uuid with NO member FK —
  -- mirroring audit_events.actor_id, the canonical actor record. The composite
  -- member-FK rule governs business references (owner/assignee) that MUST be
  -- members; the actor is different: support / system / api_key actors have no
  -- membership in the tenant they act on, so a member FK here would reject their
  -- (fully legitimate) mutations. This row rides that mutation's transaction, so
  -- that rejection would roll the whole mutation back.
  actor_id     uuid,
  -- Mirrors the full ActorKind enum (@kaenal/types) — a partner-portal actor
  -- mutates too, and this row rides that mutation's transaction, so a missing
  -- value here would fail the CHECK and roll the whole mutation back.
  actor_kind   text NOT NULL DEFAULT 'system'
                 CHECK (actor_kind IN ('user', 'system', 'api_key', 'support', 'partner')),
  -- The event envelope ONLY (ids + timestamp) — never row data.
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Delivery state machine: pending → delivered, or pending → failed once
  -- attempts are exhausted (the dead-letter state; a human/redrive tool clears it).
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts     int  NOT NULL DEFAULT 0,
  last_error   text,
  -- Backoff gate: the drainer only claims rows whose available_at has passed, so
  -- a failed delivery is retried later, not hot-looped.
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Leading tenant_id satisfies the isolation contract AND is the drainer's seek
-- index: it claims (tenant_id, status='pending', available_at <= now()) rows.
CREATE INDEX IF NOT EXISTS outbox_tenant_idx ON outbox (tenant_id, status, available_at);

SELECT apply_tenant_rls('outbox');
