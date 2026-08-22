import type { AuditEventInput } from "@kaenal/db";
import type { AuditAction } from "@kaenal/types";
import type { OutboxAction, OutboxRecord } from "./outbox.types.js";

/**
 * The audit → outbox mapping (Sequence 2), the twin of the realtime bridge's
 * `signalForAuditEvent`. Rule 3 routes every mutation through `withAudit`, so
 * that choke point is also where a durable domain event can be derived for free:
 * no service has to remember to emit, and a new mutation is covered the moment
 * it writes its (mandatory) audit event.
 *
 * Pure and total — returns a record or `null`, never throws — because the writer
 * runs it INSIDE the mutation's transaction (unguarded); a throw here would roll
 * a real business change back. It is unit-tested against every branch.
 */

/**
 * Which audit `entityKind`s become externally-deliverable domain events. The
 * allow-list mirrors the realtime bridge's topic map so the two stay in step:
 * business records worth telling a consumer about, and deliberately NOT the
 * internal churn (session, membership, settings, integration, export, file, …)
 * that would only bloat the outbox. `eventType` is namespaced by the entity kind
 * itself (`${entityKind}.${action}`) — the stable identifier already used across
 * the codebase — rather than inventing a second naming scheme.
 */
const OUTBOX_ENTITIES: ReadonlySet<string> = new Set([
  "ncr",
  "ncr_action",
  "eight_d",
  "capa",
  "capa_action",
  "inspection",
  "inspection_template",
  "finding",
  "audit",
  "audit_finding",
  "supplier",
  "ppap_submission",
  "scar",
  "document",
  "document_version",
  "fmea",
  "fmea_item",
]);

/**
 * Collapse the audit verb to the three actions a consumer distinguishes — the
 * same reduction the realtime bridge makes, kept local so the outbox owns its
 * public contract independently.
 */
export function auditActionToOutbox(action: AuditAction): OutboxAction {
  if (action === "created") return "created";
  if (action === "deleted" || action === "purged") return "deleted";
  // status_changed / assigned / updated / restored / linked / file_attached / … → "the row changed".
  return "updated";
}

/**
 * Build the outbox record for an audit event, or `null` if its kind is not an
 * externally-deliverable domain event. Carries only identity — never the audit
 * event's before/after payloads.
 */
export function outboxEventFor(event: AuditEventInput, tenantId: string): OutboxRecord | null {
  if (!OUTBOX_ENTITIES.has(event.entityKind)) return null;
  const action = auditActionToOutbox(event.action);
  return {
    tenantId,
    eventType: `${event.entityKind}.${action}`,
    entityKind: event.entityKind,
    entityId: event.entityId,
    action,
    actorId: event.actorId,
    actorKind: event.actorKind,
    payload: { entityId: event.entityId, at: new Date().toISOString() },
  };
}
