import { setAuditObserver, type AuditEventInput } from "@kaenal/db";
import type { Capability } from "@kaenal/core";
import type { AuditAction, RealtimeAction, RealtimeTopic } from "@kaenal/types";
import { bufferRealtimeSignal } from "../context.js";
import type { RealtimeSignal } from "./realtime.service.js";

/**
 * The realtime bridge (Phase R2).
 *
 * Rule 3 already routes EVERY tenant mutation through `withAudit`, so that is
 * the single choke point where a realtime cache-invalidation signal can be
 * derived for free — no service has to remember to emit, and a new mutation is
 * covered the moment it writes its (mandatory) audit event. This maps an audit
 * event's identity to the topic the web should refresh and the capability a
 * member must hold to be told about it, then buffers the signal for after-commit
 * publication (never on rollback).
 */

interface TopicBinding {
  readonly topic: RealtimeTopic;
  /** Only members holding this capability are signalled — a role that can't view
   *  the module never even learns its data changed (matches RBAC×data, B6). */
  readonly capability: Capability;
}

/**
 * Audit `entityKind` → the web topic + gating capability. Kinds absent here
 * (session, membership, file, export, settings, integration, …) are not web
 * list surfaces and produce no signal. Verified against the entityKind literals
 * actually written by the services and the capability each controller enforces
 * (8D and findings intentionally ride NCR / inspection view rights).
 */
const ENTITY_TOPIC: Readonly<Record<string, TopicBinding>> = {
  ncr: { topic: "ncr", capability: "ncr:view" },
  ncr_action: { topic: "ncr", capability: "ncr:view" },
  eight_d: { topic: "eightd", capability: "ncr:view" },
  capa: { topic: "capa", capability: "capa:view" },
  capa_action: { topic: "capa", capability: "capa:view" },
  inspection: { topic: "inspection", capability: "inspection:view" },
  inspection_template: { topic: "inspection", capability: "inspection:view" },
  finding: { topic: "inspection", capability: "inspection:view" },
  audit: { topic: "audit", capability: "audit:view" },
  audit_finding: { topic: "audit", capability: "audit:view" },
  supplier: { topic: "supplier", capability: "supplier:view" },
  ppap_submission: { topic: "ppap", capability: "ppap:view" },
  scar: { topic: "scar", capability: "scar:view" },
  document: { topic: "document", capability: "document:view" },
  document_version: { topic: "document", capability: "document:view" },
  fmea: { topic: "fmea", capability: "fmea:view" },
  fmea_item: { topic: "fmea", capability: "fmea:view" },
};

/** Collapse the audit verb to the three actions a client cares about. */
export function auditActionToRealtime(action: AuditAction): RealtimeAction {
  if (action === "created") return "created";
  if (action === "deleted" || action === "purged") return "deleted";
  // status_changed / assigned / updated / restored / linked / file_attached / … —
  // all "the row changed, refetch it".
  return "updated";
}

/** Build the realtime signal for an audit event, or null if its kind is not a
 *  web topic. Pure — unit-tested. */
export function signalForAuditEvent(event: AuditEventInput, tenantId: string): RealtimeSignal | null {
  const binding = ENTITY_TOPIC[event.entityKind];
  if (binding === undefined) return null;
  return {
    tenantId,
    capability: binding.capability,
    event: {
      topic: binding.topic,
      action: auditActionToRealtime(event.action),
      entityId: event.entityId,
      at: new Date().toISOString(),
    },
  };
}

/** Wire the audit choke point to the realtime buffer. Called once at bootstrap;
 *  idempotent (replaces any prior observer). */
export function installAuditRealtimeBridge(): void {
  setAuditObserver((event, tenantId) => {
    const signal = signalForAuditEvent(event, tenantId);
    if (signal !== null) bufferRealtimeSignal(signal);
  });
}

/** Remove the bridge (test teardown / shutdown hygiene). */
export function uninstallAuditRealtimeBridge(): void {
  setAuditObserver(undefined);
}
