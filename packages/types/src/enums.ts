import { z } from "zod";

/**
 * Single source of truth for every domain enum (01 §4).
 *
 * Postgres enums are painful to migrate, so the DB uses `text` + a CHECK
 * constraint whose value list is generated from these arrays at migration
 * authoring time. `packages/db/scripts/check-enums.ts` asserts the DB
 * constraints still match these lists, so drift fails CI rather than
 * silently accepting an out-of-range value.
 *
 * Values are DB-facing snake_case and must match `02-DATABASE.md` §2 exactly.
 */

/** Helper: build a Zod enum + expose the literal tuple for SQL generation. */
const defineEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  Object.assign(z.enum(values), { values });

// --- Identity & tenancy ----------------------------------------------------

export const TenancyModel = defineEnum(["shared", "dedicated"]);
export type TenancyModel = z.infer<typeof TenancyModel>;

export const TenantStatus = defineEnum([
  "active",
  "suspended",
  "offboarding",
  "offboarded",
  "provisioning_failed",
]);
export type TenantStatus = z.infer<typeof TenantStatus>;

export const UserStatus = defineEnum(["active", "invited", "deactivated"]);
export type UserStatus = z.infer<typeof UserStatus>;

/** RBAC roles. Capability matrix lives in `03-API.md` §3. */
export const Role = defineEnum([
  "admin",
  "manager",
  "auditor",
  "inspector",
  "viewer",
  // External supplier contact (P11). Scoped to ONE supplier_id, portal-only
  // capabilities, no access to internal endpoints. See 07 / FEATURES §17.
  "partner",
]);
export type Role = z.infer<typeof Role>;

/**
 * The internal (staff) roles — every role except the external `partner`. Used
 * by the internal member-invite flow, which must never mint an un-scoped
 * `partner` membership (partner onboarding is the portal-specific invite path).
 */
export const InternalRole = defineEnum([
  "admin",
  "manager",
  "auditor",
  "inspector",
  "viewer",
]);
export type InternalRole = z.infer<typeof InternalRole>;

// --- Inspections -----------------------------------------------------------

export const TemplateStatus = defineEnum(["draft", "published", "archived"]);
export type TemplateStatus = z.infer<typeof TemplateStatus>;

export const InspectionStatus = defineEnum([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);
export type InspectionStatus = z.infer<typeof InspectionStatus>;

/** Recurrence frequency for a scheduled inspection series (02 §2, 06 `schedule`). */
export const RecurrenceFreq = defineEnum(["daily", "weekly", "monthly"]);
export type RecurrenceFreq = z.infer<typeof RecurrenceFreq>;

export const RiskLevel = defineEnum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

/** Dynamic form item types for `inspection_templates.schema` (02 §2). */
export const FormItemType = defineEnum([
  "pass_fail",
  "yes_no",
  "score",
  "text",
  "textarea",
  "number",
  "select",
  "multiselect",
  "date",
  "datetime",
  "photo",
  "signature",
  "header",
  "info",
]);
export type FormItemType = z.infer<typeof FormItemType>;

export const FindingSeverity = defineEnum(["minor", "major", "critical"]);
export type FindingSeverity = z.infer<typeof FindingSeverity>;

// --- NCR -------------------------------------------------------------------

export const NcrSource = defineEnum([
  "inspection",
  "manual",
  "complaint",
  "audit",
]);
export type NcrSource = z.infer<typeof NcrSource>;

export const NcrPriority = defineEnum(["minor", "major", "critical"]);
export type NcrPriority = z.infer<typeof NcrPriority>;

export const NcrStatus = defineEnum([
  "draft",
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "verified",
  "closed",
  "escalated",
  "reopened",
]);
export type NcrStatus = z.infer<typeof NcrStatus>;

export const SlaState = defineEnum(["on_track", "at_risk", "breached"]);
export type SlaState = z.infer<typeof SlaState>;

export const NcrActionKind = defineEnum([
  "containment",
  "corrective",
  "preventive",
]);
export type NcrActionKind = z.infer<typeof NcrActionKind>;

export const NcrActionStatus = defineEnum([
  "pending",
  "in_progress",
  "done",
  "verified",
]);
export type NcrActionStatus = z.infer<typeof NcrActionStatus>;

// --- 8D --------------------------------------------------------------------

export const EightDStatus = defineEnum(["active", "completed", "cancelled"]);
export type EightDStatus = z.infer<typeof EightDStatus>;

export const EightDStepStatus = defineEnum([
  "pending",
  "in_progress",
  "complete",
]);
export type EightDStepStatus = z.infer<typeof EightDStepStatus>;

// --- Audits ----------------------------------------------------------------

export const AuditType = defineEnum([
  "internal",
  "certification",
  "supplier",
  "process",
]);
export type AuditType = z.infer<typeof AuditType>;

export const AuditPhase = defineEnum([
  "planned",
  "preparation",
  "fieldwork",
  "reporting",
  "closed",
]);
export type AuditPhase = z.infer<typeof AuditPhase>;

export const AuditFindingKind = defineEnum([
  "major_nc",
  "minor_nc",
  "opportunity",
]);
export type AuditFindingKind = z.infer<typeof AuditFindingKind>;

// --- CAPA ------------------------------------------------------------------

export const CapaType = defineEnum(["corrective", "preventive"]);
export type CapaType = z.infer<typeof CapaType>;

export const CapaPhase = defineEnum([
  "initiation",
  "root_cause",
  "action_plan",
  "implementation",
  "verification",
  "effectiveness",
  "closed",
]);
export type CapaPhase = z.infer<typeof CapaPhase>;

export const CapaActionStatus = defineEnum([
  "pending",
  "in_progress",
  "done",
  "verified",
]);
export type CapaActionStatus = z.infer<typeof CapaActionStatus>;

// --- Documents & files -----------------------------------------------------

export const DocumentCategory = defineEnum([
  "manual",
  "sop",
  "work_instruction",
  "form",
  "record",
  "audit_report",
  "supplier",
  "training",
]);
export type DocumentCategory = z.infer<typeof DocumentCategory>;

export const DocumentStatus = defineEnum([
  "draft",
  "pending",
  "approved",
  "rejected",
  "archived",
]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const ScanStatus = defineEnum(["pending", "clean", "infected"]);
export type ScanStatus = z.infer<typeof ScanStatus>;

// --- Suppliers -------------------------------------------------------------

export const SupplierStatus = defineEnum([
  "active",
  "probation",
  "suspended",
  "inactive",
]);
export type SupplierStatus = z.infer<typeof SupplierStatus>;

// PPAP submission review workflow (P09), matching `suppliers-ppap.jsx`:
// pending (received, not yet in review) → in_review → interim (interim approval)
// / approved / rejected. Reconciled from 0001's generic draft/submitted set by
// migration 0020.
export const PpapStatus = defineEnum([
  "pending",
  "in_review",
  "interim",
  "approved",
  "rejected",
]);
export type PpapStatus = z.infer<typeof PpapStatus>;

// Per-element review state within a submission. N/A means the element is
// legitimately waived (excluded from the completeness denominator).
export const PpapElementStatus = defineEnum([
  "pending",
  "approved",
  "changes_requested",
  "n_a",
]);
export type PpapElementStatus = z.infer<typeof PpapElementStatus>;

// SCAR lifecycle (P10). Coarse status; the 8D `currentD` (1–8) is the fine
// progress and `overdue` is derived from the due dates — neither is a stored
// status. Reconciled from 0001's generic open/responded/accepted/rejected/closed.
export const ScarStatus = defineEnum([
  "draft",
  "open",
  "responded",
  "closed",
  "rejected",
  "cancelled",
]);
export type ScarStatus = z.infer<typeof ScarStatus>;

export const ScarSeverity = defineEnum(["minor", "major", "critical"]);
export type ScarSeverity = z.infer<typeof ScarSeverity>;

// Chargeback (cost-recovery) status — a one-way ratchet (rules in packages/core).
export const ChargebackStatus = defineEnum(["pending", "debit_issued", "closed"]);
export type ChargebackStatus = z.infer<typeof ChargebackStatus>;

// --- Exports (03 §8, 06 `reports` queue) -----------------------------------

/** The record kinds an export can render. Each has a list endpoint + view cap. */
export const ExportResource = defineEnum(["ncrs", "inspections", "capas", "audits"]);
export type ExportResource = z.infer<typeof ExportResource>;

/**
 * Output formats, all behind the same async `reports` pipeline. CSV and XLSX
 * (a minimal OOXML sheet) and a simple tabular PDF are rendered server-side. A
 * richer branded PDF (headless Chromium against print routes + the PDF Template
 * Designer, 06 `reports` / 09) supersedes the tabular PDF later.
 */
export const ExportFormat = defineEnum(["csv", "xlsx", "pdf"]);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const ExportStatus = defineEnum(["queued", "processing", "completed", "failed"]);
export type ExportStatus = z.infer<typeof ExportStatus>;

// --- Audit trail (07 §1) ---------------------------------------------------

export const ActorKind = defineEnum(["user", "system", "api_key", "support"]);
export type ActorKind = z.infer<typeof ActorKind>;

/**
 * Top-level entity kinds that carry comments, cross-links, and an access log
 * (FEATURES §9 "related items · access log · comments"; §329 linkage graph).
 * Free-text `entity_kind` columns (comments, audit_events, entity_links) are
 * validated against this closed set at the API edge so a typo can't orphan a
 * comment or a link.
 */
export const EntityKind = defineEnum([
  "inspection",
  "ncr",
  "eight_d",
  "audit",
  "capa",
  "document",
  "supplier",
  "scar",
]);
export type EntityKind = z.infer<typeof EntityKind>;

export const AuditAction = defineEnum([
  "created",
  "updated",
  "status_changed",
  "assigned",
  "commented",
  "file_attached",
  "file_downloaded",
  "signed",
  "exported",
  "deleted",
  "restored",
  "purged",
  "linked",
  "unlinked",
  "signed_in",
  "sign_in_failed",
  "signed_out",
  "role_changed",
  "settings_changed",
  "entitlement_changed",
  "ai_draft_accepted",
  "support_accessed",
]);
export type AuditAction = z.infer<typeof AuditAction>;

// --- AI gateway (06 §3) ----------------------------------------------------

/** The bounded set of AI features; every model call declares one (06 §3). */
export const AiFeature = defineEnum([
  "doc_summary",
  "quicklog_structuring",
  "root_cause",
  "eightd_draft",
  "compliance_qa",
  "report_narrative",
]);
export type AiFeature = z.infer<typeof AiFeature>;

/** Provenance confidence band on an AI-drafted value (06 §3.6). */
export const AiConfidence = defineEnum(["high", "medium", "low"]);
export type AiConfidence = z.infer<typeof AiConfidence>;

/**
 * Outcome of a gateway invocation, recorded on `ai_invocations`. `blocked` is a
 * governance refusal (no pack, AI disabled, over budget, region-locked) — it
 * never reached a model; `failed` reached the provider and errored.
 */
export const AiInvocationStatus = defineEnum(["succeeded", "failed", "blocked"]);
export type AiInvocationStatus = z.infer<typeof AiInvocationStatus>;

/** Signature meanings — 21 CFR Part 11 style (07 §2). */
export const SignatureMeaning = defineEnum([
  "performed",
  "reviewed",
  "approved",
]);
export type SignatureMeaning = z.infer<typeof SignatureMeaning>;

// --- API error codes (03 §4, closed set) -----------------------------------

export const ErrorCode = defineEnum([
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "TENANT_NOT_FOUND",
  "NOT_FOUND",
  "CONFLICT",
  "INVALID_TRANSITION",
  "STALE_WRITE",
  "USER_INACTIVE",
  "RATE_LIMITED",
  "IDEMPOTENCY_REPLAY",
  "ENTITLEMENT_REQUIRED",
  "AI_UNAVAILABLE",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;
