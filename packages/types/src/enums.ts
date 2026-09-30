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
  // Sprint 05 C3 AC1 — an out-of-tolerance/failed calibration event can raise
  // a real NCR (`ncrs.source` CHECK widened in migration 0068). Confirmed
  // additive/safe: no exhaustive `NcrSource` consumer breaks (grepped this
  // session — the one UI filter over `NcrSource`, `ncr-list.tsx`, derives its
  // option list from the data it already has, never a hardcoded switch/map).
  "calibration",
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

/**
 * Corrected to the binding design's 5 values (`audits.jsx` `AUDIT_TYPES`,
 * Sprint 02 S2-3 AC3) — `process` (unused: no seed row, no test) is replaced
 * by `customer`/`gap`, closing the enum mismatch flagged in
 * `docs/sprints/SPRINT-02-audits.md` §1a.
 */
export const AuditType = defineEnum([
  "internal",
  "certification",
  "supplier",
  "customer",
  "gap",
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

/**
 * Audit checklist item status (Sprint 02 S2-4, `CHECKLIST_STATUS` in
 * `audits.jsx`). `major_nc`/`minor_nc`/`opportunity` share their literal
 * values with `AuditFindingKind` by design — scoring one of these auto-links a
 * finding of the same kind.
 */
export const AuditChecklistStatus = defineEnum([
  "pending",
  "conformant",
  "minor_nc",
  "major_nc",
  "opportunity",
  "na",
]);
export type AuditChecklistStatus = z.infer<typeof AuditChecklistStatus>;

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
export const ExportResource = defineEnum([
  "ncrs",
  "inspections",
  "capas",
  "audits",
  "ai_reply",
  // A single audit's PDF report (Sprint 02 S2-2 AC5/6) — distinct from the
  // `audits` table-dump resource above.
  "audit_report",
  // Sprint 03 Part B — the current ranked lines+suppliers forecast, as scoped
  // to the requesting caller, rendered to PDF (`predictive.jsx` "Forecast pack").
  "predictive_forecast_pack",
  // Sprint 04 R5 — the risk register's KPI strip + heat-map counts + full
  // table, scoped to the caller's visible risks, rendered to PDF.
  "risk_board_pack",
  // Sprint 04 M5 — one MSA study's full variance-component table + chart +
  // verdict + raw grid, scoped to `filters.studyId`, rendered to PDF.
  "gauge_rr_aiag_report",
  // Sprint 05 C5 AC2 — the instrument register's KPI strip + full table +
  // each instrument's last calibration date/result, rendered to PDF.
  "calibration_audit_pack",
  // Sprint 05 T3 AC2 — every mandatory gap + every record expiring within 30
  // days, rendered to PDF.
  "skill_gap_report",
]);
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

// `partner` is an EXTERNAL supplier-portal actor (P11) — their audited writes
// (SCAR respond, PPAP re-submit) are attributable and distinct from staff.
export const ActorKind = defineEnum(["user", "system", "api_key", "support", "partner"]);
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
  // Sprint 03 G1 AC4 — an inspection finding, now a first-class graph node
  // (`entity_links`'s CHECK gained it in migration 0063).
  "finding",
  // Sprint 04 R3 AC1 — risk register + FMEA become real graph nodes
  // (`entity_links`'s CHECK gained both in migration 0064).
  "risk",
  "fmea",
  // Sprint 06 X1 AC — customer complaints + ECN become real graph nodes
  // (`entity_links`'s CHECK gained both in migrations 0071/0072).
  "complaint",
  "ecn",
]);
export type EntityKind = z.infer<typeof EntityKind>;

// --- Predictive risk (Sprint 03 Part B, §3B) --------------------------------

/**
 * The subject kinds `risk_predictions` forecasts — production lines
 * (`areas` rows) and suppliers. `'ncr'` from the P21 draft proposal is
 * deliberately dropped: the binding jsx forecasts lines + suppliers only
 * (§3B, Q19 in SPRINT-03-graph-predictive.md).
 */
export const PredictionSubjectKind = defineEnum(["line", "supplier"]);
export type PredictionSubjectKind = z.infer<typeof PredictionSubjectKind>;

export const PredictionRiskLevel = defineEnum(["critical", "high", "medium", "low"]);
export type PredictionRiskLevel = z.infer<typeof PredictionRiskLevel>;

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
  "ai_chat",
  "support_accessed",
  // A checklist clause scored (Sprint 02 S2-4) — distinct from `status_changed`
  // (phase advance) since it targets one checklist item, not the audit's phase.
  "checklist_item_scored",
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
  // Vision: triage a defect photo into a draft NCR (title/severity/category).
  "ncr_photo_triage",
  // Assistant chat drawer (S1-4): a read-only conversational turn.
  "chat",
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

// --- Create wizard (Sprint 01 S1-1) ------------------------------------------

/** The wizard's 4-level priority (createwizard.jsx). NCRs keep their own
 *  minor/major/critical column; core maps between the two. */
export const WizardPriority = defineEnum(["low", "medium", "high", "critical"]);
export type WizardPriority = z.infer<typeof WizardPriority>;

/** A person's role on a record in the wizard's "Assignees & approvals" step. */
export const EntityPersonRole = defineEnum(["owner", "reviewer", "approver", "watcher"]);
export type EntityPersonRole = z.infer<typeof EntityPersonRole>;

/** The 8D template choices (createwizard.jsx ENTITY_TYPES['8d']). */
export const EightDTemplate = defineEnum(["auto", "medical", "aero", "standard"]);
export type EightDTemplate = z.infer<typeof EightDTemplate>;

/** The document template choices (createwizard.jsx ENTITY_TYPES.document). */
export const DocumentTemplate = defineEnum(["sop", "wi", "form", "policy", "manual", "upload"]);
export type DocumentTemplate = z.infer<typeof DocumentTemplate>;

// --- Calibration management (Sprint 05 C1/C2) -------------------------------

/** The 7 distinct instrument types the binding jsx's `INSTRUMENTS` fixture
 *  uses (`qms-modules.jsx`) — `instruments.type`'s CHECK (migration 0068). */
export const InstrumentType = defineEnum([
  "cmm",
  "comparator",
  "profilometer",
  "ndt",
  "caliper",
  "torque",
  "laser_tracker",
]);
export type InstrumentType = z.infer<typeof InstrumentType>;

/** The register's own lifecycle status — distinct from the *due status*
 *  (`packages/core/calibration.ts`'s `InstrumentDueStatus`), which is never
 *  stored (C1 AC2). `instruments.status`'s CHECK (migration 0068). */
export const InstrumentLifecycleStatus = defineEnum(["active", "retired"]);
export type InstrumentLifecycleStatus = z.infer<typeof InstrumentLifecycleStatus>;

/** A calibration event's outcome — mirrors `packages/core/calibration.ts`'s
 *  own `CalibrationResult` type exactly. `calibration_events.result` and
 *  `instruments.last_result`'s CHECKs (migration 0068). */
export const CalibrationResult = defineEnum(["pass", "adjusted", "fail"]);
export type CalibrationResult = z.infer<typeof CalibrationResult>;

// --- Customer complaints (Sprint 06 C1/P18) ---------------------------------

/** The jsx's own 5 `via` display values, exactly (`complaints.channel`'s
 *  CHECK, migration 0071). Only manual entry of the value is in scope this
 *  sprint — the enum still models all 5 real-world channels (§3.1). */
export const ComplaintChannel = defineEnum([
  "portal",
  "email_parsed",
  "web_form",
  "edi",
  "phone",
]);
export type ComplaintChannel = z.infer<typeof ComplaintChannel>;

export const ComplaintSeverity = defineEnum(["critical", "high", "medium", "low"]);
export type ComplaintSeverity = z.infer<typeof ComplaintSeverity>;

/** `complaints.status`'s CHECK (migration 0071). `"8d"`/`"capa"` are the
 *  literal DB values — a complaint's own status advances alongside whichever
 *  record it has been converted to (§2 C4 AC2), never regressing. */
export const ComplaintStatus = defineEnum([
  "triage",
  "investigation",
  "8d",
  "capa",
  "closed",
]);
export type ComplaintStatus = z.infer<typeof ComplaintStatus>;

// --- Engineering Change Notices (Sprint 06 E1/P19) --------------------------

/** `ecns.change_type`'s CHECK (migration 0072) — 4 values, `material` added
 *  beyond P19's originally-proposed 3 (§3.2, §1a). */
export const EcnChangeType = defineEnum(["design", "process", "tooling", "material"]);
export type EcnChangeType = z.infer<typeof EcnChangeType>;

export const EcnChangeRisk = defineEnum(["low", "medium", "high"]);
export type EcnChangeRisk = z.infer<typeof EcnChangeRisk>;

/**
 * The canonical 7-stage-plus-terminal machine (§3.2, §0b D1 adds `ppap`
 * between `risk_review` and `cab_approval`) — 9 values total, matching
 * `ecns.stage`'s CHECK (migration 0072) exactly. See
 * `packages/core/src/state-machines/ecn.ts` for the transition graph.
 */
export const EcnStage = defineEnum([
  "draft",
  "feasibility",
  "risk_review",
  "ppap",
  "cab_approval",
  "pilot",
  "implementation",
  "closed",
  "rejected",
]);
export type EcnStage = z.infer<typeof EcnStage>;

/** The 5 human-approval gates — `ecn_approvals.stage`'s CHECK (migration
 *  0072, §0b D1 adds `ppap`). A strict subset of `EcnStage`. */
export const EcnApprovalStage = defineEnum([
  "feasibility",
  "risk_review",
  "ppap",
  "cab_approval",
  "pilot",
]);
export type EcnApprovalStage = z.infer<typeof EcnApprovalStage>;

export const EcnApprovalDecision = defineEnum(["pending", "approved", "rejected"]);
export type EcnApprovalDecision = z.infer<typeof EcnApprovalDecision>;

/**
 * Named skip reasons for E5's auto-revise mechanism (§0 B3e) — persisted in
 * `ecns.auto_revise_result` (migration 0072) and surfaced via `EcnDto.
 * autoReviseResult`. `not_approved`/`version_exists` are pre-checked by
 * reading the document row first; `concurrent_modification` is the one
 * genuine race, caught as `DocumentsService.newVersion`'s own stale-write 409
 * inside a per-document `SAVEPOINT`; `bad_version_format` covers
 * `bumpMinorVersion` rejecting a malformed `"X.Y"` version string.
 */
export const EcnAutoReviseSkipReason = defineEnum([
  "not_approved",
  "version_exists",
  "bad_version_format",
  "concurrent_modification",
]);
export type EcnAutoReviseSkipReason = z.infer<typeof EcnAutoReviseSkipReason>;
