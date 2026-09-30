import { z } from "zod";
import {
  AiConfidence,
  AiFeature,
  AuditAction,
  AuditChecklistStatus,
  AuditFindingKind,
  AuditPhase,
  AuditType,
  CalibrationResult,
  CapaActionStatus,
  CapaPhase,
  CapaType,
  ComplaintChannel,
  ComplaintSeverity,
  ComplaintStatus,
  DocumentCategory,
  DocumentStatus,
  DocumentTemplate,
  EcnApprovalDecision,
  EcnApprovalStage,
  EcnAutoReviseSkipReason,
  EcnChangeRisk,
  EcnChangeType,
  EcnStage,
  EightDStatus,
  EightDTemplate,
  EntityPersonRole,
  WizardPriority,
  EntityKind,
  EightDStepStatus,
  ExportFormat,
  ExportResource,
  ExportStatus,
  FindingSeverity,
  InspectionStatus,
  InstrumentLifecycleStatus,
  InstrumentType,
  NcrActionKind,
  NcrActionStatus,
  NcrPriority,
  NcrSource,
  NcrStatus,
  PpapElementStatus,
  PpapStatus,
  ChargebackStatus,
  PredictionSubjectKind,
  PredictionRiskLevel,
  Role,
  ScarSeverity,
  ScarStatus,
  RecurrenceFreq,
  RiskLevel,
  ScanStatus,
  SlaState,
  SupplierStatus,
  TemplateStatus,
} from "./enums.js";
import { FormResponses, FormSchema } from "./form.js";
import { PageQuery } from "./http.js";

/**
 * Wire representations (03 §1). camelCase, the API's public shape — distinct
 * from the snake_case database rows. A service maps a row onto one of these; a
 * column rename never leaks to the client because the mapping is explicit.
 */

/**
 * A tenant member as the UI needs to render people: the person's display name
 * and their role in THIS tenant. The id is the `memberships.user_id`, which is
 * exactly what every tenant table's composite member FK points at, so the FE can
 * resolve an owner / lead / author id to a name and avatar. `name` comes from
 * `control.users`; everything else is per-tenant membership. Read-only — mutating
 * membership is the invite/admin surface, not this directory.
 */
export const MemberDto = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  role: Role,
});
export type MemberDto = z.infer<typeof MemberDto>;

/** A member plus a live workload signal — the AssignSheet's teammate rows
 *  (m-oversight.jsx): open assigned NCRs, banded Light/Steady/Busy. */
export const MemberWorkloadDto = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  role: Role,
  openNcrs: z.number().int().nonnegative(),
  band: z.enum(["light", "steady", "busy"]),
});
export type MemberWorkloadDto = z.infer<typeof MemberWorkloadDto>;

export const MemberWorkloadList = z.object({ items: z.array(MemberWorkloadDto) });
export type MemberWorkloadList = z.infer<typeof MemberWorkloadList>;

// --- Inspection templates ---------------------------------------------------

export const TemplateDto = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  version: z.number().int().positive(),
  status: TemplateStatus,
  schema: FormSchema,
  usageCount: z.number().int().nonnegative(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TemplateDto = z.infer<typeof TemplateDto>;

export const CreateTemplateBody = z.object({
  name: z.string().min(1).max(200),
  schema: FormSchema,
});
export type CreateTemplateBody = z.infer<typeof CreateTemplateBody>;

/** Edit a DRAFT template's name + schema in place (optimistic). Published
 *  templates are immutable — version them instead. */
export const UpdateTemplateBody = z.object({
  name: z.string().min(1).max(200),
  schema: FormSchema,
  version: z.number().int().nonnegative(),
});
export type UpdateTemplateBody = z.infer<typeof UpdateTemplateBody>;

/** Optimistic-concurrency body for a status transition (publish/archive). */
export const TemplateVersionBody = z.object({ version: z.number().int().nonnegative() });
export type TemplateVersionBody = z.infer<typeof TemplateVersionBody>;

/** One person + role from the wizard's "Assignees & approvals" step. The server
 *  derives the record's primary columns (owner/inspector/lead/approver) from it
 *  and stores every entry in `entity_people`. */
export const EntityPersonInput = z.object({
  userId: z.string().uuid(),
  role: EntityPersonRole,
});
export type EntityPersonInput = z.infer<typeof EntityPersonInput>;
export const EntityPeopleInput = z.array(EntityPersonInput).max(50);

/** A site the caller may raise records in (wizard "Site" select). */
export const PlantDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
});
export type PlantDto = z.infer<typeof PlantDto>;

/** A finer location within a plant (Sprint 05 C1 AC1/C6) — used by the
 *  instrument register's cascading plant→area select and area-name display.
 *  `areas` has no `code` column, only `name` (confirmed, §0/SF5). */
export const AreaDto = z.object({
  id: z.string().uuid(),
  plantId: z.string().uuid(),
  name: z.string(),
});
export type AreaDto = z.infer<typeof AreaDto>;

// --- Inspections ------------------------------------------------------------

/**
 * A recurrence rule for a scheduled-inspection series (02 §2). The `schedule`
 * job expands it into occurrence inspections 14 days ahead. `byweekday` is
 * 0=Sunday … 6=Saturday (JS `getUTCDay`), used only by `weekly`. `until` caps
 * the series (inclusive); null/absent means open-ended.
 */
export const RecurrenceRule = z.object({
  freq: RecurrenceFreq,
  interval: z.number().int().min(1).max(365),
  byweekday: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  until: z.string().datetime().nullable().optional(),
});
export type RecurrenceRule = z.infer<typeof RecurrenceRule>;

export const InspectionDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string().min(1).max(200),
  templateId: z.string().uuid(),
  /** Resolved template name for display (the list's Template column). */
  templateName: z.string().nullable(),
  templateVersion: z.number().int().positive(),
  inspectorId: z.string().uuid().nullable(),
  plantId: z.string().uuid().nullable(),
  areaId: z.string().uuid().nullable(),
  status: InspectionStatus,
  risk: RiskLevel.nullable(),
  scheduledAt: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  score: z.number().nullable(),
  responses: FormResponses,
  /** Set on a series head; the rule its occurrences are generated from. */
  recurrence: RecurrenceRule.nullable(),
  /** Set on a generated occurrence; the series head it belongs to. */
  seriesId: z.string().uuid().nullable(),
  /** Set on a generated occurrence; its calendar date (idempotency key). */
  occurrenceDate: z.string().nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InspectionDto = z.infer<typeof InspectionDto>;

export const CreateInspectionBody = z.object({
  title: z.string().min(1).max(200),
  templateId: z.string().uuid(),
  inspectorId: z.string().uuid().nullable().optional(),
  plantId: z.string().uuid().nullable().optional(),
  areaId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  /** Makes this a recurring series head; occurrences are materialised by 06. */
  recurrence: RecurrenceRule.nullable().optional(),
  /** CreateWizard fields (S1-1). */
  priority: WizardPriority.nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  areaLabel: z.string().max(200).nullable().optional(),
  people: EntityPeopleInput.optional(),
});
export type CreateInspectionBody = z.infer<typeof CreateInspectionBody>;

/**
 * Assign, reassign, or clear an inspection's inspector (P25). Orthogonal to the
 * scheduled → in_progress → completed machine — it never touches status.
 * `inspectorId` is a uuid to assign, `null` to unassign; `version` is the
 * optimistic-concurrency token and a non-null id must be an active member.
 */
export const AssignInspectionBody = z.object({
  version: z.number().int().nonnegative(),
  inspectorId: z.string().uuid().nullable(),
});
export type AssignInspectionBody = z.infer<typeof AssignInspectionBody>;

/** Set, change, or clear (null) the recurrence on a series head. */
export const SetRecurrenceBody = z.object({
  recurrence: RecurrenceRule.nullable(),
  version: z.number().int().nonnegative(),
});
export type SetRecurrenceBody = z.infer<typeof SetRecurrenceBody>;

/**
 * Completing an inspection submits the answers and the concurrency token. The
 * server validates the responses against the template schema and computes the
 * score — the client never sends a score, because a client-computed score is a
 * number a customer can forge.
 */
export const CompleteInspectionBody = z.object({
  responses: FormResponses,
  version: z.number().int().nonnegative(),
});
export type CompleteInspectionBody = z.infer<typeof CompleteInspectionBody>;

export const StartInspectionBody = z.object({
  version: z.number().int().nonnegative(),
});
export type StartInspectionBody = z.infer<typeof StartInspectionBody>;

// --- Findings ---------------------------------------------------------------

export const FindingDto = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  itemRef: z.string(),
  severity: FindingSeverity,
  description: z.string(),
  ncrId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FindingDto = z.infer<typeof FindingDto>;

export const CreateFindingBody = z.object({
  itemRef: z.string().min(1).max(200),
  severity: FindingSeverity,
  description: z.string().min(1).max(4000),
});
export type CreateFindingBody = z.infer<typeof CreateFindingBody>;

// --- NCRs -------------------------------------------------------------------

export const NcrDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  source: NcrSource,
  sourceId: z.string().uuid().nullable(),
  priority: NcrPriority,
  /** Optional risk band (independent of severity/priority) — mobile detail "Details". */
  risk: z.enum(["low", "medium", "high", "critical"]).nullable(),
  /** Free-text category (e.g. "Weld defect / porosity") — mobile detail + create. */
  category: z.string().nullable(),
  status: NcrStatus,
  ownerId: z.string().uuid().nullable(),
  /** Owner's display name (resolved) — the detail "Owner" row. */
  ownerName: z.string().nullable(),
  /** Who raised the NCR (=created_by) — the detail's "Reporter" row. */
  reporterId: z.string().uuid().nullable(),
  /** Reporter's display name (resolved) — the detail "Reporter" row. */
  reporterName: z.string().nullable(),
  plantId: z.string().uuid().nullable(),
  areaId: z.string().uuid().nullable(),
  /** Resolved display names for the detail header meta ("Plant A · Line 2"). */
  plantName: z.string().nullable(),
  areaName: z.string().nullable(),
  /** Units affected, lifted from `impact` — shown in the create review + detail. */
  unitsAffected: z.number().int().nonnegative().nullable(),
  dueAt: z.string().datetime().nullable(),
  slaState: SlaState,
  /** The 8D raised from this NCR, if any — the list's "Linked 8D" column and
   *  the detail's investigation cross-link both read it. */
  eightDId: z.string().uuid().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  verifiedBy: z.string().uuid().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type NcrDto = z.infer<typeof NcrDto>;

export const CreateNcrBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(8000).nullable().optional(),
  priority: NcrPriority,
  /** Free-text category (m-ncr create step 2) — persisted on the NCR. */
  category: z.string().max(120).nullable().optional(),
  source: NcrSource.optional(),
  sourceId: z.string().uuid().nullable().optional(),
  /** Raising an NCR from a finding links the finding and defaults the source. */
  findingId: z.string().uuid().optional(),
  plantId: z.string().uuid().nullable().optional(),
  areaId: z.string().uuid().nullable().optional(),
  /** Immediate-containment checklist selections — each becomes a done
   *  ncr_actions(kind='containment') row in the same transaction. */
  containment: z.array(z.string().min(1).max(2000)).max(20).optional(),
  /** Evidence files already uploaded via presign; linked to this NCR on create. */
  evidenceFileIds: z.array(z.string().uuid()).max(20).optional(),
  /** CreateWizard fields (S1-1): an explicit due date overrides the SLA-derived
   *  one; free-text area; assignees + roles. */
  dueAt: z.string().datetime().nullable().optional(),
  areaLabel: z.string().max(200).nullable().optional(),
  people: EntityPeopleInput.optional(),
});
export type CreateNcrBody = z.infer<typeof CreateNcrBody>;

/** The manager-side moves (everything except verify, which has its own route). */
export const NcrTransition = z.enum([
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
  "escalated",
  "reopened",
]);
export type NcrTransition = z.infer<typeof NcrTransition>;

export const TransitionNcrBody = z.object({
  to: NcrTransition,
  version: z.number().int().nonnegative(),
  /** Required when `to === "assigned"`: the member who takes ownership. */
  ownerId: z.string().uuid().optional(),
  reason: z.string().max(2000).optional(),
  /** Admin/manager override to close over an open 8D (audited). */
  force: z.boolean().optional(),
});
export type TransitionNcrBody = z.infer<typeof TransitionNcrBody>;

export const VerifyNcrBody = z.object({
  version: z.number().int().nonnegative(),
  reason: z.string().max(2000).optional(),
});
export type VerifyNcrBody = z.infer<typeof VerifyNcrBody>;

/**
 * Assign, reassign, or clear an NCR's owner (P25) — orthogonal to the lifecycle
 * machine, so it is its own endpoint. The `open → assigned` transition still
 * sets the *first* owner; this reassigns or clears at any state without moving
 * status. `ownerId` is a uuid to assign, `null` to unassign; `version` is the
 * optimistic-concurrency token and a non-null id must be an active member.
 */
export const AssignNcrBody = z.object({
  version: z.number().int().nonnegative(),
  ownerId: z.string().uuid().nullable(),
});
export type AssignNcrBody = z.infer<typeof AssignNcrBody>;

// --- NCR corrective actions -------------------------------------------------

export const NcrActionDto = z.object({
  id: z.string().uuid(),
  ncrId: z.string().uuid(),
  kind: NcrActionKind,
  description: z.string(),
  ownerId: z.string().uuid().nullable(),
  dueAt: z.string().datetime().nullable(),
  status: NcrActionStatus,
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type NcrActionDto = z.infer<typeof NcrActionDto>;

export const CreateNcrActionBody = z.object({
  kind: NcrActionKind,
  description: z.string().min(1).max(4000),
  ownerId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});
export type CreateNcrActionBody = z.infer<typeof CreateNcrActionBody>;

export const UpdateNcrActionStatusBody = z.object({
  status: NcrActionStatus,
  version: z.number().int().nonnegative(),
});
export type UpdateNcrActionStatusBody = z.infer<typeof UpdateNcrActionStatusBody>;

// --- CAPAs ------------------------------------------------------------------

export const CapaDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: CapaType,
  priority: NcrPriority, // capas.priority shares the minor|major|critical scale
  risk: RiskLevel.nullable(),
  status: CapaPhase, // the phase column; forward-only except an audited revert
  ownerId: z.string().uuid().nullable(),
  sponsorId: z.string().uuid().nullable(),
  sourceKind: z.string().nullable(),
  sourceId: z.string().uuid().nullable(),
  dueAt: z.string().datetime().nullable(),
  effectivenessCheckAt: z.string().datetime().nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CapaDto = z.infer<typeof CapaDto>;

export const CreateCapaBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(8000).nullable().optional(),
  type: CapaType,
  priority: NcrPriority,
  risk: RiskLevel.nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  sponsorId: z.string().uuid().nullable().optional(),
  /** Where the CAPA came from (e.g. `ncr`, `audit_finding`) + the row it links. */
  sourceKind: z.string().min(1).max(64).nullable().optional(),
  sourceId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  effectivenessCheckAt: z.string().datetime().nullable().optional(),
});
export type CreateCapaBody = z.infer<typeof CreateCapaBody>;

/**
 * Advancing a CAPA moves it one phase forward. `to` is the target phase — the
 * machine only allows the immediate next, so this both documents intent and is
 * validated server-side; `version` is the optimistic-concurrency token.
 */
export const AdvanceCapaBody = z.object({
  to: CapaPhase,
  version: z.number().int().nonnegative(),
  reason: z.string().max(2000).optional(),
});
export type AdvanceCapaBody = z.infer<typeof AdvanceCapaBody>;

/**
 * Reverting a CAPA is the deliberate exception to forward-only motion (02 §4):
 * it always requires a reason and always writes an audit event. `to` must be an
 * earlier phase.
 */
export const RevertCapaBody = z.object({
  to: CapaPhase,
  version: z.number().int().nonnegative(),
  reason: z.string().min(1).max(2000),
});
export type RevertCapaBody = z.infer<typeof RevertCapaBody>;

/**
 * Assign, reassign, or clear a CAPA's owner and/or sponsor (P25) — orthogonal to
 * the phase machine, so it is its own endpoint. Each field is tri-state: a uuid
 * assigns, an explicit `null` unassigns, and an absent key leaves that column
 * untouched. At least one of the two must be provided. `version` is the
 * optimistic-concurrency token; every non-null id must be an active member.
 */
export const AssignCapaBody = z
  .object({
    version: z.number().int().nonnegative(),
    ownerId: z.string().uuid().nullable().optional(),
    sponsorId: z.string().uuid().nullable().optional(),
  })
  .refine((b) => b.ownerId !== undefined || b.sponsorId !== undefined, {
    message: "Provide ownerId and/or sponsorId",
  });
export type AssignCapaBody = z.infer<typeof AssignCapaBody>;

// --- CAPA actions -----------------------------------------------------------

export const CapaActionDto = z.object({
  id: z.string().uuid(),
  capaId: z.string().uuid(),
  description: z.string(),
  ownerId: z.string().uuid().nullable(),
  dueAt: z.string().datetime().nullable(),
  status: CapaActionStatus,
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CapaActionDto = z.infer<typeof CapaActionDto>;

export const CreateCapaActionBody = z.object({
  description: z.string().min(1).max(4000),
  ownerId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});
export type CreateCapaActionBody = z.infer<typeof CreateCapaActionBody>;

export const UpdateCapaActionStatusBody = z.object({
  status: CapaActionStatus,
  version: z.number().int().nonnegative(),
});
export type UpdateCapaActionStatusBody = z.infer<typeof UpdateCapaActionStatusBody>;

// --- Documents --------------------------------------------------------------

export const DocumentDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  category: DocumentCategory,
  status: DocumentStatus,
  version: z.string(), // the semantic version label, e.g. "1.0"
  fileId: z.string().uuid().nullable(),
  /** Attached file's mime + size, resolved for the list/detail so the library
   *  can show file-type icons and sizes without an N+1 fetch (null = no file). */
  fileMime: z.string().nullable(),
  fileSizeBytes: z.number().int().nonnegative().nullable(),
  ownerId: z.string().uuid().nullable(),
  approverId: z.string().uuid().nullable(),
  expiresAt: z.string().datetime().nullable(),
  frameworks: z.array(z.string()),
  aiSummary: z.string().nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DocumentDto = z.infer<typeof DocumentDto>;

export const DocumentVersionDto = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  version: z.string(),
  fileId: z.string().uuid().nullable(),
  changelog: z.string().nullable(),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type DocumentVersionDto = z.infer<typeof DocumentVersionDto>;

export const CreateDocumentBody = z.object({
  title: z.string().min(1).max(200),
  category: DocumentCategory,
  /** The file is attached separately (03 §7, not yet built), so it is optional. */
  fileId: z.string().uuid().nullable().optional(),
  frameworks: z.array(z.string().min(1).max(64)).max(50).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  changelog: z.string().max(4000).nullable().optional(),
  /** CreateWizard fields (S1-1). */
  template: DocumentTemplate.nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  plantId: z.string().uuid().nullable().optional(),
  areaLabel: z.string().max(200).nullable().optional(),
  people: EntityPeopleInput.optional(),
});
export type CreateDocumentBody = z.infer<typeof CreateDocumentBody>;

/**
 * The author-side lifecycle moves (submit for review, send a rejected draft back
 * to editing, retire an approved document). Approval/rejection is a separate
 * route (its own capability + the four-eyes rule), like NCR verify.
 */
export const DocumentTransition = z.enum(["pending", "draft", "archived"]);
export type DocumentTransition = z.infer<typeof DocumentTransition>;

export const TransitionDocumentBody = z.object({
  to: DocumentTransition,
  version: z.number().int().nonnegative(), // optimistic-concurrency token
  reason: z.string().max(2000).optional(),
});
export type TransitionDocumentBody = z.infer<typeof TransitionDocumentBody>;

/** A controlled document is approved or rejected by someone other than its author. */
export const ReviewDocumentBody = z.object({
  decision: z.enum(["approve", "reject"]),
  version: z.number().int().nonnegative(), // optimistic-concurrency token
  reason: z.string().max(2000).optional(),
});
export type ReviewDocumentBody = z.infer<typeof ReviewDocumentBody>;

/**
 * Revising an approved document does not move it backwards — it opens a new
 * draft version (a fresh `document_versions` row) while the approved version
 * stays approved and auditable. `nextVersion` is the new label; `version` is the
 * concurrency token on the current row.
 */
export const NewDocumentVersionBody = z.object({
  nextVersion: z.string().min(1).max(32),
  version: z.number().int().nonnegative(),
  fileId: z.string().uuid().nullable().optional(),
  changelog: z.string().max(4000).nullable().optional(),
  /**
   * Small, additive, optional override (SPRINT-06 §0 B3b): when omitted
   * (every existing caller, incl. `documents.controller.ts`'s own route),
   * behaviour is unchanged — `owner_id = actorId`, exactly as before this
   * field existed. ECN's auto-revise (E5) always passes this explicitly, set
   * to the document's own CURRENT `owner_id` (read before the call), so a
   * document's ownership never silently changes as a side effect of an ECN
   * reaching `implementation`.
   */
  ownerId: z.string().uuid().optional(),
});
export type NewDocumentVersionBody = z.infer<typeof NewDocumentVersionBody>;

// --- Files ------------------------------------------------------------------

export const FileDto = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().nullable(),
  scanStatus: ScanStatus,
  entityKind: z.string().nullable(),
  entityId: z.string().uuid().nullable(),
  uploadedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FileDto = z.infer<typeof FileDto>;

/**
 * Step 1 of the upload (03 §7): the server validates mime + size, creates a
 * `pending` row, and returns a presigned PUT the client uploads to directly.
 * The real byte cap is enforced server-side (`validateUpload` in core), so the
 * declared `sizeBytes` is a hint the server re-checks against the actual object
 * on complete.
 */
export const PresignFileBody = z.object({
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  entityKind: z.string().min(1).max(64).nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
});
export type PresignFileBody = z.infer<typeof PresignFileBody>;

export const PresignFileResult = z.object({
  fileId: z.string().uuid(),
  uploadUrl: z.string().url(),
  expiresIn: z.number().int().positive(),
});
export type PresignFileResult = z.infer<typeof PresignFileResult>;

/** Step 3: the client tells the server the upload finished; body carries nothing. */
export const CompleteFileBody = z.object({});
export type CompleteFileBody = z.infer<typeof CompleteFileBody>;

/**
 * `?disposition=inline` renders the file in place (the document Preview);
 * the default `attachment` forces a download (the Download button).
 */
export const DownloadFileQuery = z.object({
  disposition: z.enum(["inline", "attachment"]).optional(),
});
export type DownloadFileQuery = z.infer<typeof DownloadFileQuery>;

export const DownloadFileResult = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
  /** True when the file is not yet scanned clean — the client should watermark it. */
  scanPending: z.boolean(),
});
export type DownloadFileResult = z.infer<typeof DownloadFileResult>;

// --- Search -----------------------------------------------------------------

/** The entity kinds the command palette federates over (03 §1, 04). */
export const SearchEntityKind = z.enum(["inspection", "ncr", "capa", "document", "audit", "complaint", "ecn"]);
export type SearchEntityKind = z.infer<typeof SearchEntityKind>;

export const SearchResultDto = z.object({
  kind: SearchEntityKind,
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  /** FTS relevance (ts_rank); higher is better. Only meaningful within a kind. */
  rank: z.number(),
});
export type SearchResultDto = z.infer<typeof SearchResultDto>;

export const SearchResults = z.object({
  items: z.array(SearchResultDto),
});
export type SearchResults = z.infer<typeof SearchResults>;

// --- Notifications ----------------------------------------------------------

export const NotificationDto = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  entityKind: z.string().nullable(),
  entityId: z.string().uuid().nullable(),
  /** Who caused this notification (an assigner), for the row avatar. NULL for
   *  system/job notifications with no actor (document_expiring, export_ready…). */
  actorId: z.string().uuid().nullable(),
  /** The user flagged this to find it later (the star toggle). */
  starred: z.boolean(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type NotificationDto = z.infer<typeof NotificationDto>;

/** Notification list page: the standard cursor page plus an optional `total`
 *  (the caller's notifications matching the same filters, ignoring the cursor). */
export const NotificationPageDto = z.object({
  items: z.array(NotificationDto),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative().optional(),
});
export type NotificationPageDto = z.infer<typeof NotificationPageDto>;

/** Toggle the star on one of the caller's notifications. */
export const StarNotificationBody = z.object({ starred: z.boolean() });
export type StarNotificationBody = z.infer<typeof StarNotificationBody>;

export const UnreadCountDto = z.object({ count: z.number().int().nonnegative() });
export type UnreadCountDto = z.infer<typeof UnreadCountDto>;

/** How many rows a bulk action touched (mark-all-read). */
export const CountDto = z.object({ count: z.number().int().nonnegative() });
export type CountDto = z.infer<typeof CountDto>;

/** Per-notification-kind channel switches (the `notification_prefs.matrix`). */
export const ChannelPrefs = z.object({
  inapp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
});
export type ChannelPrefs = z.infer<typeof ChannelPrefs>;

export const NotificationPrefsDto = z.object({
  matrix: z.record(z.string(), ChannelPrefs),
});
export type NotificationPrefsDto = z.infer<typeof NotificationPrefsDto>;

export const UpdateNotificationPrefsBody = z.object({
  matrix: z.record(z.string(), ChannelPrefs),
});
export type UpdateNotificationPrefsBody = z.infer<typeof UpdateNotificationPrefsBody>;

// --- User preferences (self-scoped; S1-9 / S1-7) -----------------------------

export const AiProminence = z.enum(["front", "normal", "quiet"]);
export type AiProminence = z.infer<typeof AiProminence>;
export const AccentKey = z.enum(["ink", "indigo", "teal", "orange"]);
export type AccentKey = z.infer<typeof AccentKey>;
export const DensityKey = z.enum(["comfortable", "compact"]);
export type DensityKey = z.infer<typeof DensityKey>;

export const UserPreferencesSettings = z.object({
  aiProminence: AiProminence,
  accent: AccentKey,
  density: DensityKey,
  keyboardShortcuts: z.boolean(),
  showKeyboardHints: z.boolean(),
  locale: z.enum(["en"]),
});
export type UserPreferencesSettings = z.infer<typeof UserPreferencesSettings>;

export const USER_PREFERENCES_DEFAULTS: UserPreferencesSettings = {
  aiProminence: "normal",
  accent: "ink",
  density: "comfortable",
  keyboardShortcuts: true,
  showKeyboardHints: true,
  locale: "en",
};

/** The caller's preferences; `lockVersion` 0 = never saved (defaults). */
export const UserPreferencesDto = UserPreferencesSettings.extend({
  lockVersion: z.number().int().nonnegative(),
});
export type UserPreferencesDto = z.infer<typeof UserPreferencesDto>;

/** Partial update (PATCH semantics) guarded by the `version` last read. */
export const UpdateUserPreferencesBody = UserPreferencesSettings.partial()
  .extend({ version: z.number().int().nonnegative() })
  .refine((b) => Object.keys(b).some((k) => k !== "version"), { message: "Nothing to update" });
export type UpdateUserPreferencesBody = z.infer<typeof UpdateUserPreferencesBody>;

// --- 8D ----------------------------------------------------------------------

export const EightDStepDto = z.object({
  status: EightDStepStatus,
  completedAt: z.string().datetime().nullable().optional(),
  completedBy: z.string().uuid().nullable().optional(),
  /** Discipline-specific payload (D2 problem statement, D4 root cause, …). */
  data: z.record(z.string(), z.unknown()).optional(),
});
export type EightDStepDto = z.infer<typeof EightDStepDto>;

export const EightDDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  ncrId: z.string().uuid().nullable(),
  status: EightDStatus,
  teamLeadId: z.string().uuid().nullable(),
  championId: z.string().uuid().nullable(),
  memberIds: z.array(z.string().uuid()),
  startedAt: z.string().datetime().nullable(),
  targetAt: z.string().datetime().nullable(),
  currentStep: z.number().int().min(1).max(8),
  steps: z.record(z.string(), EightDStepDto),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EightDDto = z.infer<typeof EightDDto>;

export const CreateEightDBody = z.object({
  title: z.string().min(1).max(200),
  /** Raising an 8D from an NCR links it and blocks the NCR's close until done. */
  ncrId: z.string().uuid().optional(),
  teamLeadId: z.string().uuid().nullable().optional(),
  championId: z.string().uuid().nullable().optional(),
  memberIds: z.array(z.string().uuid()).max(50).optional(),
  targetAt: z.string().datetime().nullable().optional(),
  /** CreateWizard fields (S1-1). `ncrCode` links by the human code the wizard
   *  collects ("NCR-2026-…"); it is resolved server-side (unknown → 404). */
  ncrCode: z.string().min(1).max(64).optional(),
  template: EightDTemplate.nullable().optional(),
  priority: WizardPriority.nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  plantId: z.string().uuid().nullable().optional(),
  areaLabel: z.string().max(200).nullable().optional(),
  people: EntityPeopleInput.optional(),
});
export type CreateEightDBody = z.infer<typeof CreateEightDBody>;

export const UpdateEightDStepBody = z.object({
  status: EightDStepStatus,
  data: z.record(z.string(), z.unknown()).optional(),
  version: z.number().int().nonnegative(),
});
export type UpdateEightDStepBody = z.infer<typeof UpdateEightDStepBody>;

export const TransitionEightDBody = z.object({
  to: z.enum(["completed", "cancelled"]),
  version: z.number().int().nonnegative(),
  reason: z.string().max(2000).optional(),
});
export type TransitionEightDBody = z.infer<typeof TransitionEightDBody>;

/**
 * Assign, reassign, or clear an 8D's team lead and/or champion (P25) —
 * orthogonal to the step machine, so it is its own endpoint and never touches
 * `status` or `currentStep`. Each field is tri-state: a uuid assigns, an
 * explicit `null` unassigns, and an absent key leaves that column untouched. At
 * least one of the two must be provided; every non-null id must be an active
 * member and `version` is the optimistic-concurrency token.
 */
export const AssignEightDBody = z
  .object({
    version: z.number().int().nonnegative(),
    teamLeadId: z.string().uuid().nullable().optional(),
    championId: z.string().uuid().nullable().optional(),
  })
  .refine((b) => b.teamLeadId !== undefined || b.championId !== undefined, {
    message: "Provide teamLeadId and/or championId",
  });
export type AssignEightDBody = z.infer<typeof AssignEightDBody>;

// --- Audits ------------------------------------------------------------------

/** One clause of an audit's checklist (Sprint 02 S2-4, `checklist` jsonb column). */
export const AuditChecklistItem = z.object({
  id: z.string().uuid(),
  clause: z.string(),
  section: z.string(),
  text: z.string(),
  status: AuditChecklistStatus,
  notes: z.string().nullable(),
  /** Set once scoring this item auto-created (or was linked to) a finding. */
  findingId: z.string().uuid().nullable(),
});
export type AuditChecklistItem = z.infer<typeof AuditChecklistItem>;

/** Score one checklist item; version-checked against the audit's `lockVersion`
 *  (a checklist edit bumps it like any other audit mutation). */
export const UpdateAuditChecklistItemBody = z.object({
  status: AuditChecklistStatus,
  notes: z.string().max(4000).nullable().optional(),
  version: z.number().int().nonnegative(),
});
export type UpdateAuditChecklistItemBody = z.infer<typeof UpdateAuditChecklistItemBody>;

/** Findings breakdown by kind — shared by the detail sidebar and the list KPI strip. */
export const AuditFindingsSummary = z.object({
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  opportunity: z.number().int().nonnegative(),
});
export type AuditFindingsSummary = z.infer<typeof AuditFindingsSummary>;

export const AuditDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  standard: z.string().nullable(),
  type: AuditType,
  status: AuditPhase,
  leadAuditorId: z.string().uuid().nullable(),
  team: z.array(z.string().uuid()),
  /** The department/people being audited — distinct from `team` (the audit team). */
  auditeeIds: z.array(z.string().uuid()),
  plantId: z.string().uuid().nullable(),
  location: z.string().nullable(),
  scope: z.array(z.string()),
  startAt: z.string().datetime().nullable(),
  endAt: z.string().datetime().nullable(),
  /** Freeform, lead-auditor-set; "—" is rendered client-side for null. */
  nextActivity: z.string().nullable(),
  /** Computed from `checklist` (non-`pending` ÷ total, 0 if empty) — never
   *  column-backed (the dead `audits.progress` column is dropped). */
  progress: z.number(),
  checklist: z.array(AuditChecklistItem),
  findingsSummary: AuditFindingsSummary,
  capasOpen: z.number().int().nonnegative(),
  capasTotal: z.number().int().nonnegative(),
  closedAt: z.string().datetime().nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuditDto = z.infer<typeof AuditDto>;

export const CreateAuditBody = z.object({
  title: z.string().min(1).max(200),
  type: AuditType,
  standard: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  scope: z.array(z.string().min(1).max(200)).max(50).optional(),
  leadAuditorId: z.string().uuid().nullable().optional(),
  team: z.array(z.string().uuid()).max(50).optional(),
  auditeeIds: z.array(z.string().uuid()).max(50).optional(),
  plantId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  nextActivity: z.string().max(500).nullable().optional(),
});
export type CreateAuditBody = z.infer<typeof CreateAuditBody>;

/** Advance an audit one phase forward (planned → … → closed). */
export const AdvanceAuditBody = z.object({
  to: AuditPhase,
  version: z.number().int().nonnegative(),
  reason: z.string().max(2000).optional(),
  nextActivity: z.string().max(500).nullable().optional(),
});
export type AdvanceAuditBody = z.infer<typeof AdvanceAuditBody>;

/** Last-6-months audit counts grouped by type (S2-1 frequency chart). */
export const AuditFrequencyPointDto = z.object({
  month: z.string(),
  counts: z.record(AuditType, z.number().int().nonnegative()),
});
export type AuditFrequencyPointDto = z.infer<typeof AuditFrequencyPointDto>;

export const AuditFrequencyResult = z.object({
  points: z.array(AuditFrequencyPointDto),
});
export type AuditFrequencyResult = z.infer<typeof AuditFrequencyResult>;

/** The `/audits` KPI strip — one aggregate query, not a client tally over a page. */
export const AuditStatsDto = z.object({
  active: z.number().int().nonnegative(),
  plannedNext90d: z.number().int().nonnegative(),
  completedYtd: z.number().int().nonnegative(),
  openFindings: z.number().int().nonnegative(),
});
export type AuditStatsDto = z.infer<typeof AuditStatsDto>;

export const AuditFindingDto = z.object({
  id: z.string().uuid(),
  auditId: z.string().uuid(),
  clause: z.string().nullable(),
  kind: AuditFindingKind,
  title: z.string().nullable(),
  description: z.string(),
  dueDate: z.string().datetime().nullable(),
  ncrId: z.string().uuid().nullable(),
  capaId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuditFindingDto = z.infer<typeof AuditFindingDto>;

export const CreateAuditFindingBody = z.object({
  kind: AuditFindingKind,
  description: z.string().min(1).max(4000),
  clause: z.string().max(200).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export type CreateAuditFindingBody = z.infer<typeof CreateAuditFindingBody>;

/** Raise an NCR from an audit finding (links `audit_findings.ncr_id`). */
export const RaiseNcrFromFindingBody = z.object({
  priority: NcrPriority,
  title: z.string().min(1).max(200).optional(),
});
export type RaiseNcrFromFindingBody = z.infer<typeof RaiseNcrFromFindingBody>;

/** Raise a CAPA from an audit finding (links `audit_findings.capa_id`). */
export const RaiseCapaFromFindingBody = z.object({
  type: CapaType,
  priority: NcrPriority,
  title: z.string().min(1).max(200).optional(),
});
export type RaiseCapaFromFindingBody = z.infer<typeof RaiseCapaFromFindingBody>;

// --- Exports (03 §8) --------------------------------------------------------

/** Optional filters narrowing the exported set; applied by the renderer.
 *  `auditId` is required for (and only meaningful for) an `audit_report`
 *  export — the one audit whose PDF report is being rendered. */
export const ExportFilters = z.object({
  status: z.string().max(60).optional(),
  auditId: z.string().uuid().optional(),
  /** Required for (and only meaningful for) a `gauge_rr_aiag_report` export —
   *  the one MSA study whose report is being rendered (Sprint 04 M5). */
  studyId: z.string().uuid().optional(),
});
export type ExportFilters = z.infer<typeof ExportFilters>;

export const ExportDto = z.object({
  id: z.string().uuid(),
  resource: ExportResource,
  format: ExportFormat,
  status: ExportStatus,
  filters: ExportFilters,
  rowCount: z.number().int().nonnegative().nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
  error: z.string().nullable(),
  /**
   * A short-TTL presigned download URL, present only once the export is
   * `completed`. Minted per read (07 §3) — never stored — so it is absent on
   * `queued`/`processing`/`failed`.
   */
  downloadUrl: z.string().url().nullable(),
  requestedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ExportDto = z.infer<typeof ExportDto>;

/**
 * The AI reply a user asked to export ("Generate PDF", S1-4). Chat history is
 * not persisted server-side, so the text + provenance is frozen on the export
 * row at request time. The requester exports their own visible reply; it is
 * never fed back to a model or written to an entity.
 */
export const AiReplyExportPayload = z.object({
  text: z.string().min(1).max(20_000),
  confidence: z.enum(["high", "medium", "low"]),
  /** Provider label shown on the reply ("stub" until a real model is wired). */
  provider: z.string().max(40).optional(),
  invocationId: z.string().uuid().optional(),
  sources: z.array(z.object({ kind: z.string().max(40), id: z.string().max(64) })).max(20).default([]),
  generatedAt: z.string().datetime().optional(),
});
export type AiReplyExportPayload = z.infer<typeof AiReplyExportPayload>;

export const CreateExportBody = z
  .object({
    resource: ExportResource,
    /** csv / xlsx / pdf; the enum is where new renderers slot in. */
    format: ExportFormat.default("csv"),
    filters: ExportFilters.optional(),
    /** Required for (and only for) `resource: "ai_reply"`. */
    aiReply: AiReplyExportPayload.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.resource === "ai_reply" && v.aiReply === undefined) {
      ctx.addIssue({ code: "custom", path: ["aiReply"], message: "aiReply is required for an ai_reply export" });
    }
    if (v.resource !== "ai_reply" && v.aiReply !== undefined) {
      ctx.addIssue({ code: "custom", path: ["aiReply"], message: "aiReply is only valid for an ai_reply export" });
    }
    if (v.resource === "audit_report" && v.filters?.auditId === undefined) {
      ctx.addIssue({ code: "custom", path: ["filters", "auditId"], message: "filters.auditId is required for an audit_report export" });
    }
  });
export type CreateExportBody = z.infer<typeof CreateExportBody>;

// --- Me (session identity) --------------------------------------------------

/** A plant the current member is scoped to (empty list = all plants). */
export const MePlantDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
});
export type MePlantDto = z.infer<typeof MePlantDto>;

export const MeDto = z.object({
  userId: z.string().uuid(),
  tenantSlug: z.string(),
  /** Display name of the active workspace (control.tenants.name). */
  tenantName: z.string(),
  role: z.string(),
  capabilities: z.array(z.string()),
  /** Identity from the shared account (control.users). */
  name: z.string(),
  email: z.string(),
  mfaEnabled: z.boolean(),
  /** When the account last signed in (ISO), or null if never. Shown on the
   *  Security page's sign-in method card. */
  lastLoginAt: z.string().datetime().nullable(),
  /** Plants this membership is scoped to; empty means all plants. */
  plants: z.array(MePlantDto),
  /** Open items owned by the caller — the dropdown's "N NCRs · M CAPAs". */
  openNcrs: z.number().int().nonnegative(),
  openCapas: z.number().int().nonnegative(),
});
export type MeDto = z.infer<typeof MeDto>;

// --- Workspaces (the profile switcher, shell.jsx) ---------------------------

/** One workspace the signed-in person belongs to (across tenants). */
export const WorkspaceDto = z.object({
  tenantSlug: z.string(),
  tenantName: z.string(),
  role: z.string(),
  /** True for the workspace the current request is scoped to. */
  active: z.boolean(),
  /**
   * The target-workspace session token, returned ONLY on `switch-workspace` and
   * ONLY to bearer clients (the mobile app, which sends `X-Auth-Mode: bearer` and
   * has no cookie jar — 05 §3). Web clients receive the session as an httpOnly
   * cookie and never see this field. Absent on the workspaces list.
   */
  sessionToken: z.string().optional(),
});
export type WorkspaceDto = z.infer<typeof WorkspaceDto>;

export const WorkspacesDto = z.object({ items: z.array(WorkspaceDto) });
export type WorkspacesDto = z.infer<typeof WorkspacesDto>;

/** Switch the active workspace to one the caller is already a member of. */
export const SwitchWorkspaceBody = z.object({ slug: z.string().min(1).max(63) });
export type SwitchWorkspaceBody = z.infer<typeof SwitchWorkspaceBody>;

// --- AI gateway (06 §3) -----------------------------------------------------

/** A reference to an entity the draft is about, echoed back as a source. */
export const AiEntityRef = z.object({
  kind: z.string().min(1).max(40),
  id: z.string().min(1).max(64),
});
export type AiEntityRef = z.infer<typeof AiEntityRef>;

/** A cited source behind a drafted value (06 §3.6). */
export const AiSource = z.object({
  kind: z.string(),
  id: z.string(),
  quote: z.string().optional(),
});
export type AiSource = z.infer<typeof AiSource>;

/** Request an AI draft for a feature. The input is treated as untrusted data. */
export const AiDraftRequest = z.object({
  feature: AiFeature,
  input: z.string().min(1).max(20_000),
  entityRefs: z.array(AiEntityRef).max(20).optional(),
  maxTokens: z.number().int().positive().max(4096).optional(),
  /** Base64-encoded images (no data: prefix) for vision features like
   *  `ncr_photo_triage`. Capped small — a phone sends one compressed photo. */
  imagesBase64: z.array(z.string().min(1).max(15_000_000)).max(4).optional(),
});
export type AiDraftRequest = z.infer<typeof AiDraftRequest>;

/** A returned draft: the value plus its provenance. AI never writes an entity. */
export const AiDraftDto = z.object({
  invocationId: z.string().uuid(),
  value: z.string(),
  confidence: AiConfidence,
  sources: z.array(AiSource),
});
export type AiDraftDto = z.infer<typeof AiDraftDto>;

/** Accept a drafted summary onto a document (06 §3 — acceptance is a mutation). */
export const AcceptAiSummaryBody = z.object({
  documentId: z.string().uuid(),
  /** The (possibly user-edited) summary text being accepted. */
  value: z.string().min(1).max(20_000),
  /** The invocation the value came from — must be a real succeeded call. */
  invocationId: z.string().uuid(),
  /** Optimistic-concurrency token: the document's current lock version. */
  version: z.number().int().nonnegative(),
});
export type AcceptAiSummaryBody = z.infer<typeof AcceptAiSummaryBody>;

export const AiSummaryDto = z.object({
  documentId: z.string().uuid(),
  aiSummary: z.string(),
  lockVersion: z.number().int().nonnegative(),
});
export type AiSummaryDto = z.infer<typeof AiSummaryDto>;

// --- AI assistant chat (S1-4) ------------------------------------------------

/** Entity a chat turn is scoped to (resolved server-side under RLS). */
export const AiChatEntityRef = z.object({
  kind: EntityKind,
  id: z.string().uuid(),
});
export type AiChatEntityRef = z.infer<typeof AiChatEntityRef>;

export const AiChatTurn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type AiChatTurn = z.infer<typeof AiChatTurn>;

/**
 * `POST /v1/ai/chat` body. The client sends the entity REFERENCE only; the
 * server assembles the governed context under RLS, so no client-supplied text
 * is trusted as context. Prior turns are the user's own conversation (nothing
 * is persisted server-side). An `Idempotency-Key` header is accepted.
 */
export const AiChatRequest = z.object({
  message: z.string().trim().min(1).max(4000),
  entityRef: AiChatEntityRef.optional(),
  history: z.array(AiChatTurn).max(20).optional(),
});
export type AiChatRequest = z.infer<typeof AiChatRequest>;

/** Reasons an in-stream failure can carry (never a fake reply). */
export const AiChatErrorCode = z.enum([
  "AI_UNAVAILABLE",
  "ENTITLEMENT_REQUIRED",
  "BUDGET_EXCEEDED",
  "AI_DISABLED",
  "REGION_LOCKED",
]);
export type AiChatErrorCode = z.infer<typeof AiChatErrorCode>;

/**
 * One SSE `data:` frame of the chat stream: `delta`* then exactly one `done` or
 * `error`. `done` carries provenance (confidence + sources + provider label).
 */
export const AiChatChunk = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    invocationId: z.string().uuid(),
    requestId: z.string(),
    confidence: AiConfidence,
    sources: z.array(AiSource),
    /** "stub" = deterministic placeholder, not a real model. */
    provider: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    code: AiChatErrorCode,
    message: z.string(),
    requestId: z.string(),
  }),
]);
export type AiChatChunk = z.infer<typeof AiChatChunk>;

// --- Collaboration: comments, links, access log -----------------------------
// FEATURES §9 (document detail = "related items · access log · comments") and
// §329 (the cross-module linkage graph). These are generic over EntityKind so
// the same three endpoints serve documents, NCRs, 8Ds, audits, CAPAs, etc.

/** A `?entityKind=&entityId=` selector shared by the comments and links lists. */
export const EntityRefQuery = z.object({
  entityKind: EntityKind,
  entityId: z.string().uuid(),
});
export type EntityRefQuery = z.infer<typeof EntityRefQuery>;

export const CommentDto = z.object({
  id: z.string().uuid(),
  entityKind: EntityKind,
  entityId: z.string().uuid(),
  authorId: z.string().uuid(),
  /** Author's display name, resolved server-side (null if unknown) — so the
   *  comment thread reads without a second round-trip. */
  authorName: z.string().nullable(),
  body: z.string(),
  parentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CommentDto = z.infer<typeof CommentDto>;

export const CreateCommentBody = z.object({
  entityKind: EntityKind,
  entityId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  /** Threaded reply — must be a comment on the same entity. */
  parentId: z.string().uuid().nullable().optional(),
});
export type CreateCommentBody = z.infer<typeof CreateCommentBody>;

/**
 * A member mention inside a comment body is the token `@[Display Name](user:<uuid>)`.
 * The server extracts these ids (deduped) to raise `mention` notifications.
 */
export function extractMentionedUserIds(body: string): string[] {
  const ids = new Set<string>();
  for (const m of body.matchAll(/@\[[^\]\n]{1,120}\]\(user:([0-9a-fA-F-]{36})\)/g)) {
    const id = m[1]?.toLowerCase();
    if (id !== undefined && z.string().uuid().safeParse(id).success) ids.add(id);
  }
  return [...ids];
}

/**
 * One row of an entity's access log — a projection of `audit_events` that
 * deliberately omits `before`/`after` (which can carry changed field values) so
 * the log reveals who did what and when without leaking payloads (07 §1).
 */
export const AuditEventDto = z.object({
  id: z.string().uuid(),
  entityKind: z.string(),
  entityId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  /** Actor's display name, resolved server-side (null for system/unknown
   *  actors) — the access-log / activity-feed line ("Raised by Sara Chen"). */
  actorName: z.string().nullable(),
  actorKind: z.string(),
  action: AuditAction,
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditEventDto = z.infer<typeof AuditEventDto>;

/**
 * A row of the tenant-wide audit log (Settings › System › Audit log; 07 §1,
 * FEATURES §9). This is the workspace-scoped security/compliance trail — every
 * mutation across every module — read only by an admin (`auditlog:read`). It is
 * a richer projection than the per-record `AuditEventDto`: the actor is resolved
 * to a display name and the target to a human code, so the table reads without a
 * second round-trip. It still carries NO before/after payloads — the trail
 * reveals who/what/when/from-where, never the field values a role otherwise
 * can't read (the same rule the per-record log follows). `sensitive` is derived
 * server-side from the action (permission/role/settings/security events) so the
 * UI can flag high-signal rows consistently rather than re-deriving the list.
 */
export const AuditLogEntryDto = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  actorId: z.string().uuid().nullable(),
  actorKind: z.string(),
  /** Resolved display name, or a stand-in ("System", "Former member") when the
   *  actor is a job or a since-removed membership. Never null — the column shows
   *  something for every row. */
  actorName: z.string(),
  action: AuditAction,
  entityKind: z.string(),
  entityId: z.string().uuid(),
  /** Human label for the affected record — the record's code where resolvable
   *  (e.g. "NCR-2026-0142"), else a readable "<Kind> ·<short id>" fallback. */
  targetLabel: z.string(),
  reason: z.string().nullable(),
  ip: z.string().nullable(),
  sensitive: z.boolean(),
});
export type AuditLogEntryDto = z.infer<typeof AuditLogEntryDto>;

/**
 * Filters for the tenant-wide audit log. All optional and combined with AND;
 * every filter is pushed into SQL (never applied in memory) so the keyset page
 * stays correct under filtering. `from`/`to` bound `created_at`. Target-code
 * free-text search is intentionally omitted from v1: the code lives on the
 * source record, not on `audit_events`, so a faithful search needs a
 * denormalised label column (a future migration) rather than an 8-way join.
 */
export const AuditLogQuery = z
  .object({
    actorId: z.string().uuid().optional(),
    action: AuditAction.optional(),
    entityKind: EntityKind.optional(),
    /** Only high-signal (security / permission / support) events. */
    sensitiveOnly: z.coerce.boolean().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .merge(PageQuery);
export type AuditLogQuery = z.infer<typeof AuditLogQuery>;

/**
 * A directed link between two records (FEATURES §329). `relation` is a free
 * label ("linked", "containment_wi", "reference", …). The link is stored once
 * from `from` → `to`; the detail view queries links touching a record on either
 * side, so a document sees the NCR that cites it and the audit that sampled it.
 */
export const EntityLinkDto = z.object({
  id: z.string().uuid(),
  fromKind: EntityKind,
  fromId: z.string().uuid(),
  toKind: EntityKind,
  toId: z.string().uuid(),
  relation: z.string(),
  /** The end OPPOSITE the queried record — what the detail view renders. */
  createdAt: z.string().datetime(),
  /**
   * A server-resolved, human-readable label for the end OPPOSITE the queried
   * record (Sprint 04 R3 `[AMENDED-2]`) — e.g. a risk's `"RISK-2026-0004 —
   * Ransomware exposure"` or an FMEA's `partCode`. Capability-checked per
   * target record: present only when the caller can view that specific
   * record, omitted (never a raw or guessed value) otherwise, so a link
   * panel never leaks a label the caller shouldn't see (rule 8's spirit
   * extended to a partial-visibility read, not just a 404).
   */
  label: z.string().nullable().optional(),
});
export type EntityLinkDto = z.infer<typeof EntityLinkDto>;

export const CreateEntityLinkBody = z.object({
  fromKind: EntityKind,
  fromId: z.string().uuid(),
  toKind: EntityKind,
  toId: z.string().uuid(),
  relation: z.string().min(1).max(64).optional(),
});
export type CreateEntityLinkBody = z.infer<typeof CreateEntityLinkBody>;

// --- Supply chain — Suppliers (FEATURES §11.1, P08) ------------------------

/**
 * Raw KPI metrics stored on `suppliers.scorecard`. The WEIGHTED score is derived
 * in `packages/core` (`weightedSupplierScore`) and never persisted — the same
 * supplier can be scored under different weights without a write.
 */
export const SupplierScorecard = z.object({
  ppm: z.number().nullable().optional(),
  ppmTarget: z.number().nullable().optional(),
  otd: z.number().nullable().optional(),
  otdTarget: z.number().nullable().optional(),
  oqe: z.number().nullable().optional(),
  oqeTarget: z.number().nullable().optional(),
  scarHours: z.number().nullable().optional(),
  scarTarget: z.number().nullable().optional(),
  materialRejectsPct: z.number().nullable().optional(),
  materialRejectsTarget: z.number().nullable().optional(),
  ppmTrend: z.array(z.number()).nullable().optional(),
  otdTrend: z.array(z.number()).nullable().optional(),
});
export type SupplierScorecard = z.infer<typeof SupplierScorecard>;

/** Display-only descriptive bulk (`suppliers.profile`) — parts, spend, certs,
 *  contract dates, historical PPAP programs, AI insights. Typed but open. */
export const SupplierProfile = z.record(z.string(), z.unknown());
export type SupplierProfile = z.infer<typeof SupplierProfile>;

const SupplierGrade = z.enum(["A", "B", "C", "D"]);
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/**
 * A `DateOnly` that additionally rejects a date strictly after the server's
 * current UTC calendar day (Sprint 05 C2 AC7/T2 AC4 — a calibration cannot be
 * "performed," nor a training "completed," tomorrow). String comparison on
 * `YYYY-MM-DD` is chronological, so a plain `<=` works. This is a coarse,
 * schema-level guard against an unambiguously-future date (e.g. next month) —
 * the sprint's own authoritative rule compares against the instrument's plant
 * timezone (C2 AC7) / the tenant's own timezone (T2 AC4, B4(c)), which needs a
 * DB row and so is enforced again, exactly, in the service; this guard cannot
 * see that timezone and so never substitutes for it.
 */
const notFutureDate = (fieldLabel: string) =>
  DateOnly.refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: `${fieldLabel} cannot be in the future`,
  });

export const SupplierDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  tier: z.number().int().nullable(),
  category: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  status: SupplierStatus,
  // Manual grade is authoritative; ai* is advisory. Both on the RiskLevel scale
  // (A=low … D=critical in the visual spec).
  riskTier: RiskLevel.nullable(),
  aiRiskTier: RiskLevel.nullable(),
  aiRiskConfidence: z.number().int().nullable(),
  flags: z.array(z.string()),
  contact: z.record(z.string(), z.unknown()).nullable(),
  certExpires: z.string().nullable(),
  lastAudit: z.string().nullable(),
  nextAudit: z.string().nullable(),
  scorecard: SupplierScorecard,
  profile: SupplierProfile,
  /** Weighted 0–100 score + letter grade under the applied weights. */
  score: z.number().nullable(),
  grade: SupplierGrade.nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SupplierDto = z.infer<typeof SupplierDto>;

export const CreateSupplierBody = z.object({
  name: z.string().min(1).max(200),
  // Optional so imports can carry their existing code; auto-generated otherwise.
  code: z.string().min(1).max(40).optional(),
  tier: z.number().int().min(1).max(5).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  status: SupplierStatus.optional(),
  riskTier: RiskLevel.nullable().optional(),
  aiRiskTier: RiskLevel.nullable().optional(),
  aiRiskConfidence: z.number().int().min(0).max(100).nullable().optional(),
  flags: z.array(z.string().max(40)).max(20).optional(),
  contact: z.record(z.string(), z.unknown()).nullable().optional(),
  certExpires: DateOnly.nullable().optional(),
  lastAudit: DateOnly.nullable().optional(),
  nextAudit: DateOnly.nullable().optional(),
  scorecard: SupplierScorecard.optional(),
  profile: SupplierProfile.optional(),
});
export type CreateSupplierBody = z.infer<typeof CreateSupplierBody>;

export const UpdateSupplierBody = CreateSupplierBody.partial().extend({
  version: z.number().int().nonnegative(),
});
export type UpdateSupplierBody = z.infer<typeof UpdateSupplierBody>;

/** Invite a supplier contact to the supplier portal (P11). The supplier comes from the URL. */
export const PartnerInviteBody = z.object({
  email: z.string().email().max(320),
});
export type PartnerInviteBody = z.infer<typeof PartnerInviteBody>;

export const PartnerInviteResult = z.object({
  email: z.string(),
  expiresAt: z.string(),
  /** Returned outside production only (no mail delivery there); never in production. */
  token: z.string().optional(),
});
export type PartnerInviteResult = z.infer<typeof PartnerInviteResult>;

/** A supplier-portal contact's lifecycle state (P11). */
export const PortalContactStatus = z.enum(["invited", "enrolment_pending", "active", "revoked"]);
export type PortalContactStatus = z.infer<typeof PortalContactStatus>;

/**
 * One external contact of a supplier: either a pending invitation (`invited`) or
 * a `partner` membership scoped to that supplier. `id` is the invitation id for
 * `invited` rows and the user id otherwise; the API resolves either.
 */
export const PortalContactDto = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string().nullable(),
  status: PortalContactStatus,
  mfaEnrolled: z.boolean(),
  lastSignInAt: z.string().nullable(),
  invitedAt: z.string(),
  expiresAt: z.string().nullable(),
});
export type PortalContactDto = z.infer<typeof PortalContactDto>;

/** Optional scorecard weights, as query params on the scorecard endpoint. */
export const ScorecardWeightsQuery = z.object({
  wPpm: z.coerce.number().min(0).optional(),
  wOtd: z.coerce.number().min(0).optional(),
  wOqe: z.coerce.number().min(0).optional(),
  wScar: z.coerce.number().min(0).optional(),
});
export type ScorecardWeightsQuery = z.infer<typeof ScorecardWeightsQuery>;

// --- Supply chain — PPAP submissions (FEATURES §11.2, P09) -----------------

/**
 * One of the 18 PPAP elements, stored inline on the submission. The names are
 * seeded from the canonical AIAG list (`packages/core/ppap.ts`); element 18 is
 * the PSW. `reviewer` is a member id (not FK-checked here — it lives in jsonb).
 */
export const PpapElementDto = z.object({
  id: z.number().int().min(1).max(18),
  name: z.string(),
  status: PpapElementStatus,
  // Default to null so a freshly-seeded element (which carries only id/name/status)
  // round-trips through the wire shape without the reviewer/comment keys.
  reviewer: z.string().nullable().default(null),
  comment: z.string().nullable().default(null),
});
export type PpapElementDto = z.infer<typeof PpapElementDto>;

/** AI deadline prediction — written by the predictive job, advisory only. */
export const PpapAiPrediction = z.object({
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  willMissDeadline: z.boolean().nullable().optional(),
  daysLikelyOver: z.number().int().nullable().optional(),
  reasoning: z.string().nullable().optional(),
});
export type PpapAiPrediction = z.infer<typeof PpapAiPrediction>;

/** Derived element completeness (computed in `packages/core`, never stored). */
export const PpapCompletenessDto = z.object({
  required: z.number().int(),
  approved: z.number().int(),
  outstanding: z.number().int(),
  approvable: z.boolean(),
});
export type PpapCompletenessDto = z.infer<typeof PpapCompletenessDto>;

export const PpapSubmissionDto = z.object({
  id: z.string().uuid(),
  code: z.string().nullable(),
  supplierId: z.string().uuid(),
  /** Joined from the supplier for display; null if the supplier is gone. */
  supplierName: z.string().nullable(),
  partNumber: z.string(),
  partRev: z.string().nullable(),
  programName: z.string().nullable(),
  level: z.number().int().min(1).max(5),
  customer: z.string().nullable(),
  status: PpapStatus,
  submittedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  approvedDate: z.string().nullable(),
  owner: z.string().nullable(),
  elements: z.array(PpapElementDto),
  aiPrediction: PpapAiPrediction,
  /** now − submittedDate, whole days; null when not yet submitted. */
  daysOpen: z.number().int().nullable(),
  completeness: PpapCompletenessDto,
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PpapSubmissionDto = z.infer<typeof PpapSubmissionDto>;

export const CreatePpapBody = z.object({
  supplierId: z.string().uuid(),
  partNumber: z.string().min(1).max(120),
  level: z.number().int().min(1).max(5),
  // Optional so imports can carry an existing code; auto-generated otherwise.
  code: z.string().min(1).max(40).optional(),
  partRev: z.string().max(40).nullable().optional(),
  programName: z.string().max(200).nullable().optional(),
  customer: z.string().max(200).nullable().optional(),
  status: PpapStatus.optional(),
  submittedDate: DateOnly.nullable().optional(),
  dueDate: DateOnly.nullable().optional(),
  owner: z.string().uuid().nullable().optional(),
});
export type CreatePpapBody = z.infer<typeof CreatePpapBody>;

/** Submission-level edits. Elements and the overall decision have their own
 *  endpoints; `code` is immutable once assigned. */
export const UpdatePpapBody = z
  .object({
    partNumber: z.string().min(1).max(120),
    level: z.number().int().min(1).max(5),
    partRev: z.string().max(40).nullable(),
    programName: z.string().max(200).nullable(),
    customer: z.string().max(200).nullable(),
    status: PpapStatus,
    submittedDate: DateOnly.nullable(),
    dueDate: DateOnly.nullable(),
    owner: z.string().uuid().nullable(),
  })
  .partial()
  .extend({ version: z.number().int().nonnegative() });
export type UpdatePpapBody = z.infer<typeof UpdatePpapBody>;

/** Set one element's review state. Optimistic on the parent submission. */
export const UpdatePpapElementBody = z.object({
  status: PpapElementStatus,
  reviewer: z.string().uuid().nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  version: z.number().int().nonnegative(),
});
export type UpdatePpapElementBody = z.infer<typeof UpdatePpapElementBody>;

/** Overall approve/reject. Approve is blocked server-side unless every non-N/A
 *  element is approved (the `packages/core` completeness rule). */
export const PpapDecisionBody = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(4000).nullable().optional(),
  version: z.number().int().nonnegative(),
});
export type PpapDecisionBody = z.infer<typeof PpapDecisionBody>;

// --- Supply chain — SCAR & chargebacks (FEATURES §11.3, P10) ---------------

/** Chargeback (cost-recovery) sub-record. Null status = no chargeback raised. */
export const ChargebackDto = z.object({
  amount: z.number().nullable(),
  currency: z.string(),
  status: ChargebackStatus.nullable(),
});
export type ChargebackDto = z.infer<typeof ChargebackDto>;

export const ScarDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  supplierId: z.string().uuid(),
  /** Joined from the supplier for display; null if the supplier is gone. */
  supplierName: z.string().nullable(),
  title: z.string().nullable(),
  severity: ScarSeverity,
  status: ScarStatus,
  /** 8D progress (1–8), forward-only. */
  currentD: z.number().int().min(1).max(8),
  raisedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  supplierResponseDue: z.string().nullable(),
  supplierAcknowledged: z.boolean(),
  ackDate: z.string().nullable(),
  affectedLots: z.number().int().nullable(),
  /** Direct link to the originating NCR (0001 column); 8D links via entity-links. */
  ncrId: z.string().uuid().nullable(),
  owner: z.string().nullable(),
  chargeback: ChargebackDto,
  /** now − raisedDate, whole days; null when not yet raised. */
  daysOpen: z.number().int().nullable(),
  /** Derived: an active SCAR whose response-due / due date has passed. */
  overdue: z.boolean(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ScarDto = z.infer<typeof ScarDto>;

export const CreateScarBody = z.object({
  supplierId: z.string().uuid(),
  title: z.string().min(1).max(200),
  severity: ScarSeverity,
  // Optional so imports can carry an existing code; auto-generated otherwise.
  code: z.string().min(1).max(40).optional(),
  status: ScarStatus.optional(),
  ncrId: z.string().uuid().nullable().optional(),
  raisedDate: DateOnly.nullable().optional(),
  dueDate: DateOnly.nullable().optional(),
  supplierResponseDue: DateOnly.nullable().optional(),
  affectedLots: z.number().int().nonnegative().nullable().optional(),
  owner: z.string().uuid().nullable().optional(),
  chargebackAmount: z.number().nonnegative().nullable().optional(),
  chargebackCurrency: z.string().min(1).max(8).optional(),
});
export type CreateScarBody = z.infer<typeof CreateScarBody>;

/** Field edits. Advance, acknowledge and chargeback transitions have their own
 *  endpoints; `code` and `currentD` are not set here. */
export const UpdateScarBody = z
  .object({
    title: z.string().min(1).max(200),
    severity: ScarSeverity,
    status: ScarStatus,
    ncrId: z.string().uuid().nullable(),
    raisedDate: DateOnly.nullable(),
    dueDate: DateOnly.nullable(),
    supplierResponseDue: DateOnly.nullable(),
    affectedLots: z.number().int().nonnegative().nullable(),
    owner: z.string().uuid().nullable(),
  })
  .partial()
  .extend({ version: z.number().int().nonnegative() });
export type UpdateScarBody = z.infer<typeof UpdateScarBody>;

/** Advance the 8D one discipline forward (D1→…→D8). Optimistic via version. */
export const AdvanceScarBody = z.object({
  reason: z.string().max(4000).nullable().optional(),
  version: z.number().int().nonnegative(),
});
export type AdvanceScarBody = z.infer<typeof AdvanceScarBody>;

/** Record the supplier's acknowledgement of the SCAR. Optimistic via version. */
export const AcknowledgeScarBody = z.object({
  ackDate: DateOnly.nullable().optional(),
  version: z.number().int().nonnegative(),
});
export type AcknowledgeScarBody = z.infer<typeof AcknowledgeScarBody>;

/** Set / transition the chargeback (one-way: none→pending→debit_issued→closed).
 *  Amount/currency may be set when raising. Optimistic via version. */
export const ScarChargebackBody = z.object({
  status: ChargebackStatus,
  amount: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(1).max(8).optional(),
  reason: z.string().max(4000).nullable().optional(),
  version: z.number().int().nonnegative(),
});
export type ScarChargebackBody = z.infer<typeof ScarChargebackBody>;

/**
 * Assign, reassign, or clear a SCAR's owner (P25). A dedicated, audited
 * (`assigned`) endpoint parallel to CAPA/NCR — distinct from the general
 * `update` (which audits `updated` and does not check membership). `owner` is a
 * uuid to assign, `null` to unassign; `version` is the optimistic-concurrency
 * token and a non-null id must be an active member.
 */
export const AssignScarBody = z.object({
  version: z.number().int().nonnegative(),
  owner: z.string().uuid().nullable(),
});
export type AssignScarBody = z.infer<typeof AssignScarBody>;

// --- Supplier portal — external, read-only projections (FEATURES §17, P11) --
//
// These are DELIBERATELY narrower than the internal ScarDto / PpapSubmissionDto:
// an external partner must never see internal identifiers (the owning member,
// the linked NCR, the reviewer member id) or internal advisory data (the AI
// prediction). The portal service maps the internal record onto these before it
// ever crosses the boundary. The supplier is implicit (it is always the caller's
// own), so supplierId/supplierName are omitted.

/** The partner's own supplier identity — what `/v1/portal/me` returns. */
export const PortalIdentityDto = z.object({
  supplierId: z.string().uuid(),
  supplierName: z.string(),
  supplierCode: z.string(),
});
export type PortalIdentityDto = z.infer<typeof PortalIdentityDto>;

export const PortalChargebackDto = z.object({
  amount: z.number().nullable(),
  currency: z.string(),
  status: ChargebackStatus.nullable(),
});
export type PortalChargebackDto = z.infer<typeof PortalChargebackDto>;

/** A SCAR as the responsible supplier sees it. No owner / linked-NCR leak. */
export const PortalScarDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string().nullable(),
  severity: ScarSeverity,
  status: ScarStatus,
  currentD: z.number().int().min(1).max(8),
  raisedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  supplierResponseDue: z.string().nullable(),
  supplierAcknowledged: z.boolean(),
  ackDate: z.string().nullable(),
  affectedLots: z.number().int().nullable(),
  chargeback: PortalChargebackDto,
  daysOpen: z.number().int().nullable(),
  overdue: z.boolean(),
});
export type PortalScarDto = z.infer<typeof PortalScarDto>;

/** One PPAP element with its reviewer feedback — but NOT the reviewer's id. */
export const PortalPpapElementDto = z.object({
  id: z.number().int().min(1).max(18),
  name: z.string(),
  status: PpapElementStatus,
  comment: z.string().nullable(),
});
export type PortalPpapElementDto = z.infer<typeof PortalPpapElementDto>;

/** A PPAP submission as the supplier sees it. No owner / AI-prediction leak. */
export const PortalPpapDto = z.object({
  id: z.string().uuid(),
  code: z.string().nullable(),
  partNumber: z.string(),
  partRev: z.string().nullable(),
  programName: z.string().nullable(),
  level: z.number().int().min(1).max(5),
  customer: z.string().nullable(),
  status: PpapStatus,
  submittedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  approvedDate: z.string().nullable(),
  elements: z.array(PortalPpapElementDto),
  completeness: PpapCompletenessDto,
  daysOpen: z.number().int().nullable(),
});
export type PortalPpapDto = z.infer<typeof PortalPpapDto>;

/** Evidence the partner attaches to their own SCAR / PPAP. `fileIds` are the ids
 *  of files the partner has already uploaded through the portal presign flow
 *  (`/v1/portal/files/*`); the server links only the caller's own, still-unlinked
 *  uploads to the record — a foreign or already-attached id is rejected. */
const PortalFileIds = z.array(z.string().uuid()).max(20).optional();

/** The supplier's response to a SCAR — a note, optionally acknowledging it, and
 *  optionally attaching evidence files. The note is recorded as a comment on the
 *  SCAR (visible to internal staff too); the files are linked to the SCAR. */
export const PortalScarRespondBody = z.object({
  note: z.string().min(1, "A response is required").max(4000),
  acknowledge: z.boolean().optional(),
  fileIds: PortalFileIds,
});
export type PortalScarRespondBody = z.infer<typeof PortalScarRespondBody>;

/** The supplier re-submits a PPAP package after changes-requested feedback,
 *  optionally with a note (recorded on the audit event) and evidence files. */
export const PortalPpapResubmitBody = z.object({
  note: z.string().max(4000).nullable().optional(),
  fileIds: PortalFileIds,
});
export type PortalPpapResubmitBody = z.infer<typeof PortalPpapResubmitBody>;

/** Presign a portal evidence upload. Unlike the internal `PresignFileBody`, the
 *  partner does NOT choose the target entity — the file is created unlinked and
 *  owned by the caller, then linked to one of the partner's own records only when
 *  they respond/re-submit. This is what keeps a partner from attaching to (or
 *  even naming) any entity but their own. */
export const PortalEvidencePresignBody = z.object({
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});
export type PortalEvidencePresignBody = z.infer<typeof PortalEvidencePresignBody>;

// --- Settings: white-label branding (04 §Settings > Multi-tenancy) -----------
// One `tenant_settings` row (namespace 'branding', 0025). The display name is
// reflected in the app shell (an empty `displayName` inherits the workspace
// name, so an unbranded tenant is unchanged); the colours, login copy and sender
// fields are stored + previewed in the editor. Applying the colours to the live
// runtime theme, and the branded pre-auth login page, are follow-ups (a runtime
// theme is a global concern; a public-by-slug branding read has rule-8
// existence-leak implications) — tracked in TODO.md.

/** A 6-digit hex colour (`#18181b`). Empty is not allowed — the editor always
 *  has a concrete colour, falling back to {@link BRANDING_DEFAULTS}. */
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #18181B");

/** An email address, or the empty string meaning "unset". */
const OptionalEmail = z.union([z.string().trim().max(254).email(), z.literal("")]);

export const BrandingSettings = z.object({
  /** Workspace display name in the shell + login. Empty = inherit the workspace
   *  name (so an unbranded tenant looks exactly as it did before branding). */
  displayName: z.string().trim().max(60).default(""),
  /** Short monogram for compact spots (sidebar rail, favicon alt). */
  shortName: z.string().trim().max(6).default(""),
  /** Accent colour — buttons, active nav. Stored; not yet applied to the theme. */
  primaryColor: HexColor.default("#18181b"),
  /** App canvas / background colour. Stored; not yet applied to the theme. */
  bgColor: HexColor.default("#f4f4f5"),
  /** Custom domain the workspace is served on (display only for now). */
  domain: z.string().trim().max(253).default(""),
  /** Login-screen tagline under the "Sign in to {name}" headline (which is
   *  derived from displayName, so there is no separate headline field). */
  loginTagline: z.string().trim().max(240).default(""),
  /** Font family name (must be one the app bundles; defaults to the token font). */
  font: z.string().trim().max(40).default("Archivo"),
  /** Support address shown in the footer / help. */
  supportEmail: OptionalEmail.default(""),
  /** Footer text under the login/app chrome. */
  footer: z.string().trim().max(160).default(""),
  /** Sender identity for notification emails. */
  fromName: z.string().trim().max(60).default(""),
  fromEmail: OptionalEmail.default(""),
});
export type BrandingSettings = z.infer<typeof BrandingSettings>;

/** The canonical unbranded defaults — every field at its schema default. The GET
 *  merges the stored `doc` over these, so a partial/legacy doc still validates. */
export const BRANDING_DEFAULTS: BrandingSettings = BrandingSettings.parse({});

/** GET response: the resolved branding plus its optimistic-concurrency token. */
export const BrandingDto = BrandingSettings.extend({
  lockVersion: z.number().int().nonnegative(),
});
export type BrandingDto = z.infer<typeof BrandingDto>;

/** PUT body: the full branding doc plus the version the editor loaded (rule 6 —
 *  a stale write is rejected with STALE_WRITE, never a silent clobber). */
export const UpdateBrandingBody = BrandingSettings.extend({
  version: z.number().int().nonnegative(),
});
export type UpdateBrandingBody = z.infer<typeof UpdateBrandingBody>;

// --- Settings: NCR validation rules (04 §Settings > Process) -----------------
// A rule gates NCR creation: it FIRES when `field <operator> value` holds and
// applies `action` with `message`. `field` is the closed set of CreateNcrBody
// fields the API can actually evaluate at create time; `block` rejects the
// create, `warn`/`escalate` are stored for later enforcement. Rules are managed
// under settings:manage and enforced in NcrService.create (table 0026).

/** The NCR create-payload fields a rule can test. */
export const NcrRuleField = z.enum(["priority", "source", "title", "description", "plant", "area"]);
export type NcrRuleField = z.infer<typeof NcrRuleField>;

/** `is_empty`/`is_not_empty` ignore `value`; `equals` matches one token; `in`
 *  matches any of a comma-separated set. */
export const NcrRuleOperator = z.enum(["is_empty", "is_not_empty", "equals", "in"]);
export type NcrRuleOperator = z.infer<typeof NcrRuleOperator>;

/** `block` rejects the create; `warn`/`escalate` are advisory (stored, not yet
 *  enforced at runtime — no warning channel / escalation job yet). */
export const NcrRuleAction = z.enum(["block", "warn", "escalate"]);
export type NcrRuleAction = z.infer<typeof NcrRuleAction>;

export const NcrValidationRuleDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  field: NcrRuleField,
  operator: NcrRuleOperator,
  value: z.string(),
  action: NcrRuleAction,
  message: z.string(),
  enabled: z.boolean(),
  lockVersion: z.number().int().nonnegative(),
});
export type NcrValidationRuleDto = z.infer<typeof NcrValidationRuleDto>;

/** The editable shape; `value` is required only for `equals`/`in` (refined so an
 *  emptiness operator needn't carry a value). */
const NcrValidationRuleShape = z
  .object({
    name: z.string().trim().min(1).max(120),
    field: NcrRuleField,
    operator: NcrRuleOperator,
    value: z.string().trim().max(400).default(""),
    action: NcrRuleAction,
    message: z.string().trim().min(1).max(400),
    enabled: z.boolean().default(true),
  })
  .refine((r) => r.operator === "is_empty" || r.operator === "is_not_empty" || r.value.length > 0, {
    message: "A value is required for the 'equals' and 'in' operators",
    path: ["value"],
  });

export const CreateNcrValidationRuleBody = NcrValidationRuleShape;
export type CreateNcrValidationRuleBody = z.infer<typeof CreateNcrValidationRuleBody>;

export const UpdateNcrValidationRuleBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    field: NcrRuleField,
    operator: NcrRuleOperator,
    value: z.string().trim().max(400).default(""),
    action: NcrRuleAction,
    message: z.string().trim().min(1).max(400),
    enabled: z.boolean().default(true),
    version: z.number().int().nonnegative(),
  })
  .refine((r) => r.operator === "is_empty" || r.operator === "is_not_empty" || r.value.length > 0, {
    message: "A value is required for the 'equals' and 'in' operators",
    path: ["value"],
  });
export type UpdateNcrValidationRuleBody = z.infer<typeof UpdateNcrValidationRuleBody>;

// --- Settings: session policy (04 §Settings > Security > Session policies) ----
// One `tenant_settings` row (namespace 'session', 0027). The enforced fields are
// the absolute timeout (drives session expires_at at sign-in) and max concurrent
// (revoke oldest at sign-in); the remaining fields are stored policy the app
// reads back (idle timeouts, remember-device, step-up window) whose runtime
// enforcement is a later slice. The design's decorative toggles (biometric,
// impossible-travel, off-hours…) are UI-only and not persisted here.

export const SessionPolicy = z.object({
  /** Web idle timeout in minutes (stored; per-request idle enforcement is later). */
  webIdleMinutes: z.number().int().min(5).max(1440).default(30),
  /** Web absolute timeout in hours — the hard session lifetime (ENFORCED). */
  webAbsoluteHours: z.number().int().min(1).max(168).default(12),
  /** Mobile idle timeout in hours (stored). */
  mobileIdleHours: z.number().int().min(1).max(72).default(8),
  /** Max concurrent sessions per user; 0 = unlimited (ENFORCED — revoke oldest). */
  maxConcurrentSessions: z.number().int().min(0).max(50).default(3),
  /** "Trust this device" duration in days; 0 = off (stored). */
  rememberDeviceDays: z.number().int().min(0).max(365).default(30),
  /** Step-up re-auth window in minutes (stored). */
  stepUpMinutes: z.number().int().min(1).max(1440).default(15),
  /** Notify the user when a new device signs in (stored). */
  notifyNewDevice: z.boolean().default(true),
});
export type SessionPolicy = z.infer<typeof SessionPolicy>;

/** The canonical defaults — every field at its schema default. */
export const SESSION_POLICY_DEFAULTS: SessionPolicy = SessionPolicy.parse({});

export const SessionPolicyDto = SessionPolicy.extend({
  lockVersion: z.number().int().nonnegative(),
});
export type SessionPolicyDto = z.infer<typeof SessionPolicyDto>;

export const UpdateSessionPolicyBody = SessionPolicy.extend({
  version: z.number().int().nonnegative(),
});
export type UpdateSessionPolicyBody = z.infer<typeof UpdateSessionPolicyBody>;

// --- Settings: legal hold register (04 §Settings > Compliance & Privacy) ------
// The litigation/audit hold register, on the foundational `legal_holds` table
// (0001, extended in 0028). A hold is `active` while `released_at IS NULL` and
// `released` once released — the one domain transition in the design. Holds are
// genuinely ENFORCED: the nightly purge job (`packages/core/purge.ts`) refuses
// to permanently erase any soft-deleted row an active hold's `scope` covers.
//
// `scope` is therefore the structured shape purge understands, exposed as a
// small tagged union: `tenant` (freeze everything), `kinds` (freeze whole entity
// kinds), or `record` (freeze one kind, optionally one row). Managed under
// settings:manage; audited + optimistic.

export const LegalHoldStatus = z.enum(["active", "released"]);
export type LegalHoldStatus = z.infer<typeof LegalHoldStatus>;

/** The entity kinds a scoped hold can target — the vocabulary the purge job maps
 *  soft-deleted rows to (a curated, user-meaningful subset). */
export const LegalHoldEntityKind = z.enum([
  "ncr",
  "inspection",
  "document",
  "capa",
  "scar",
  "eight_d",
  "audit",
  "supplier",
]);
export type LegalHoldEntityKind = z.infer<typeof LegalHoldEntityKind>;

/** API-facing scope. Maps to/from the stored jsonb: `tenant`→`{}`,
 *  `kinds`→`{entityKinds}`, `record`→`{entityKind, entityId?}`. */
export const LegalHoldScopeInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("tenant") }),
  z.object({ mode: z.literal("kinds"), entityKinds: z.array(LegalHoldEntityKind).min(1).max(20) }),
  z.object({
    mode: z.literal("record"),
    entityKind: LegalHoldEntityKind,
    entityId: z.string().uuid().optional(),
  }),
]);
export type LegalHoldScopeInput = z.infer<typeof LegalHoldScopeInput>;

export const LegalHoldDto = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  name: z.string(),
  matter: z.string(),
  scope: LegalHoldScopeInput,
  status: LegalHoldStatus,
  notes: z.string(),
  openedAt: z.string(),
  releasedAt: z.string().nullable(),
  lockVersion: z.number().int().nonnegative(),
});
export type LegalHoldDto = z.infer<typeof LegalHoldDto>;

/** The editable shape. */
const LegalHoldShape = z.object({
  name: z.string().trim().min(1).max(200),
  matter: z.string().trim().max(300).default(""),
  scope: LegalHoldScopeInput,
  notes: z.string().trim().max(2000).default(""),
});

export const CreateLegalHoldBody = LegalHoldShape;
export type CreateLegalHoldBody = z.infer<typeof CreateLegalHoldBody>;

export const UpdateLegalHoldBody = LegalHoldShape.extend({
  version: z.number().int().nonnegative(),
});
export type UpdateLegalHoldBody = z.infer<typeof UpdateLegalHoldBody>;

// --- Settings: DLP policy register (04 §Settings > Compliance & Privacy) -------
// A data-loss-prevention policy register (table 0028). Pattern + action +
// surface, toggleable. Pre-egress interception, hit metrics, and the design's
// "recent events" table need an interception layer + event log that don't exist
// yet — stored + listed + audited only, enforcement flagged in TODO. Managed
// under settings:manage.

export const DlpAction = z.enum(["block", "warn", "watermark", "quarantine", "notify"]);
export type DlpAction = z.infer<typeof DlpAction>;

export const DlpPolicyDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  pattern: z.string(),
  action: DlpAction,
  surface: z.string(),
  note: z.string(),
  enabled: z.boolean(),
  lockVersion: z.number().int().nonnegative(),
});
export type DlpPolicyDto = z.infer<typeof DlpPolicyDto>;

const DlpPolicyShape = z.object({
  name: z.string().trim().min(1).max(200),
  pattern: z.string().trim().max(400).default(""),
  action: DlpAction,
  surface: z.string().trim().max(200).default(""),
  note: z.string().trim().max(400).default(""),
  enabled: z.boolean().default(true),
});

export const CreateDlpPolicyBody = DlpPolicyShape;
export type CreateDlpPolicyBody = z.infer<typeof CreateDlpPolicyBody>;

export const UpdateDlpPolicyBody = DlpPolicyShape.extend({
  version: z.number().int().nonnegative(),
});
export type UpdateDlpPolicyBody = z.infer<typeof UpdateDlpPolicyBody>;

// --- Settings: cost centers + chargeback (04 §Settings > Multi-tenancy) --------
// A tenant-scoped cost-center hierarchy (table 0029) that memberships are
// assigned to. `seats` per centre is a REAL count of active memberships — the
// one usage signal we meter today; the chargeback report multiplies it by a
// configurable rate and splits a shared platform fee with a conserved-total
// apportionment (`packages/core/chargeback.ts`). AI + storage costs need a
// metering pipeline that doesn't exist yet and report as 0 (flagged, not faked).
// Managed under settings:manage; optimistic + audited.

export const CostCenterDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  parentId: z.string().uuid().nullable(),
  /** Active memberships assigned to this centre (read-derived). */
  seats: z.number().int().nonnegative(),
  lockVersion: z.number().int().nonnegative(),
});
export type CostCenterDto = z.infer<typeof CostCenterDto>;

const CostCenterShape = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().default(null),
});

export const CreateCostCenterBody = CostCenterShape;
export type CreateCostCenterBody = z.infer<typeof CreateCostCenterBody>;

export const UpdateCostCenterBody = CostCenterShape.extend({
  version: z.number().int().nonnegative(),
});
export type UpdateCostCenterBody = z.infer<typeof UpdateCostCenterBody>;

/** A tenant member and the cost centre they're assigned to (for the assignment panel). */
export const CostCenterAssignmentDto = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  costCenterId: z.string().uuid().nullable(),
});
export type CostCenterAssignmentDto = z.infer<typeof CostCenterAssignmentDto>;

export const AssignCostCenterBody = z.object({
  userId: z.string().uuid(),
  costCenterId: z.string().uuid().nullable(),
});
export type AssignCostCenterBody = z.infer<typeof AssignCostCenterBody>;

/** How shared platform costs split across cost centers (stored; the report honours
 *  `seatRateCents` + `platformMonthlyFeeCents`, the rest are stored policy). */
export const SeatAllocation = z.enum(["user-cc", "usage", "corp"]);
export const AiAllocation = z.enum(["user-cc", "record-cc", "split"]);
export const StorageAllocation = z.enum(["record-cc", "corp"]);

export const ChargebackSettings = z.object({
  currency: z.string().trim().min(1).max(8).default("USD"),
  /** Per-seat monthly licence cost, in cents. */
  seatRateCents: z.number().int().min(0).max(1_000_000).default(3000),
  /** A shared monthly platform fee split across centres by seats (conserved). */
  platformMonthlyFeeCents: z.number().int().min(0).max(100_000_000).default(0),
  seatAllocation: SeatAllocation.default("user-cc"),
  aiAllocation: AiAllocation.default("user-cc"),
  storageAllocation: StorageAllocation.default("record-cc"),
  showBudgetToManagers: z.boolean().default(true),
});
export type ChargebackSettings = z.infer<typeof ChargebackSettings>;

export const CHARGEBACK_DEFAULTS: ChargebackSettings = ChargebackSettings.parse({});

export const ChargebackSettingsDto = ChargebackSettings.extend({
  lockVersion: z.number().int().nonnegative(),
});
export type ChargebackSettingsDto = z.infer<typeof ChargebackSettingsDto>;

export const UpdateChargebackSettingsBody = ChargebackSettings.extend({
  version: z.number().int().nonnegative(),
});
export type UpdateChargebackSettingsBody = z.infer<typeof UpdateChargebackSettingsBody>;

/** One row of the computed monthly chargeback. `costCenterId` is null for the
 *  Unallocated bucket (members with no centre). All money is in cents. */
export const ChargebackRowDto = z.object({
  costCenterId: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  seats: z.number().int().nonnegative(),
  seatCostCents: z.number().int().nonnegative(),
  platformShareCents: z.number().int().nonnegative(),
  aiCostCents: z.number().int().nonnegative(),
  storageCostCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});
export type ChargebackRowDto = z.infer<typeof ChargebackRowDto>;

export const ChargebackReportDto = z.object({
  /** Current-month snapshot label, e.g. "2026-08". */
  period: z.string(),
  currency: z.string(),
  rows: z.array(ChargebackRowDto),
  totalCents: z.number().int().nonnegative(),
  /** True while AI + storage costs are un-metered (reported as 0). */
  meteringPending: z.boolean(),
});
export type ChargebackReportDto = z.infer<typeof ChargebackReportDto>;

// --- FMEA workbench (04 §FMEA; qms-risk-spc.jsx) ------------------------------
// An FMEA is a per-part worksheet (PFMEA/DFMEA, tables 0030); its items are
// failure modes scored on Severity/Occurrence/Detection (1–10). RPN (S×O×D) and
// Action Priority (H/M/L) are DERIVED server-side via `@kaenal/core` and returned
// on each item, so a rating edit always re-scores consistently. Managed under
// `fmea:manage`, read under `fmea:view`; optimistic + audited.

export const FmeaType = z.enum(["pfmea", "dfmea"]);
export type FmeaType = z.infer<typeof FmeaType>;

export const ActionPriority = z.enum(["H", "M", "L"]);
export type ActionPriority = z.infer<typeof ActionPriority>;

export const FmeaDto = z.object({
  id: z.string().uuid(),
  type: FmeaType,
  partCode: z.string(),
  partName: z.string(),
  revision: z.number().int().positive(),
  itemCount: z.number().int().nonnegative(),
  lockVersion: z.number().int().nonnegative(),
});
export type FmeaDto = z.infer<typeof FmeaDto>;

const FmeaShape = z.object({
  type: FmeaType.default("pfmea"),
  partCode: z.string().trim().min(1).max(60),
  partName: z.string().trim().min(1).max(200),
  revision: z.number().int().min(1).max(9999).default(1),
});
export const CreateFmeaBody = FmeaShape;
export type CreateFmeaBody = z.infer<typeof CreateFmeaBody>;
export const UpdateFmeaBody = FmeaShape.extend({ version: z.number().int().nonnegative() });
export type UpdateFmeaBody = z.infer<typeof UpdateFmeaBody>;

const Rating = z.number().int().min(1).max(10);

export const FmeaItemDto = z.object({
  id: z.string().uuid(),
  fmeaId: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  processFunction: z.string(),
  failureMode: z.string(),
  effect: z.string(),
  severity: Rating,
  cause: z.string(),
  occurrence: Rating,
  preventionControl: z.string(),
  detectionControl: z.string(),
  detection: Rating,
  recommendedAction: z.string(),
  /** Derived S×O×D (1–1000). */
  rpn: z.number().int(),
  /** Derived Action Priority (High/Medium/Low). */
  actionPriority: ActionPriority,
  lockVersion: z.number().int().nonnegative(),
});
export type FmeaItemDto = z.infer<typeof FmeaItemDto>;

const FmeaItemShape = z.object({
  processFunction: z.string().trim().max(300).default(""),
  failureMode: z.string().trim().min(1).max(300),
  effect: z.string().trim().max(400).default(""),
  severity: Rating.default(1),
  cause: z.string().trim().max(400).default(""),
  occurrence: Rating.default(1),
  preventionControl: z.string().trim().max(400).default(""),
  detectionControl: z.string().trim().max(400).default(""),
  detection: Rating.default(1),
  recommendedAction: z.string().trim().max(600).default(""),
});
export const CreateFmeaItemBody = FmeaItemShape;
export type CreateFmeaItemBody = z.infer<typeof CreateFmeaItemBody>;
export const UpdateFmeaItemBody = FmeaItemShape.extend({ version: z.number().int().nonnegative() });
export type UpdateFmeaItemBody = z.infer<typeof UpdateFmeaItemBody>;

// ── Home dashboard (05 §M5) ──────────────────────────────────────────────────
// The role-aware mobile home (project_brain/mobile/src/m-home.jsx). The server
// computes every metric live inside the request's tenant-scoped transaction (so
// RLS confines it to the caller's workspace) and returns the shape for the
// caller's role. Presentation strings ("Due 2h") are formatted on the client
// from the raw fields below — the server sends data, not copy.

/** Severity vocabulary shared by the queue/severity chips (superset of the
 *  domain enums so an inspection risk or an NCR priority both map cleanly). */
export const DashSeverity = z.enum(["critical", "high", "major", "medium", "minor", "low"]);
export type DashSeverity = z.infer<typeof DashSeverity>;

/** A single KPI stat tile. `value` is null when the metric has no data source
 *  yet (rendered as "—", never a fabricated number). */
export const DashKpi = z.object({
  label: z.string(),
  value: z.string().nullable(),
  tone: z.enum(["default", "danger", "warn", "success"]).default("default"),
  delta: z.string().optional(),
});
export type DashKpi = z.infer<typeof DashKpi>;

/** Deep-link target for a queue item / row so the client can navigate. */
export const DashRef = z.object({
  kind: z.enum(["inspection", "ncr", "capa", "document", "audit"]),
  id: z.string().uuid(),
});
export type DashRef = z.infer<typeof DashRef>;

/** A work-queue card (Inspector's "Today's work queue"). */
export const DashQueueItem = z.object({
  ref: DashRef,
  code: z.string(),
  title: z.string(),
  sev: DashSeverity.optional(),
  /** Due timestamp (ISO) or null; the client formats "Due 2h" / "Overdue 1d". */
  dueAt: z.string().datetime().nullable(),
  overdue: z.boolean(),
  site: z.string(),
  meta: z.string(),
});
export type DashQueueItem = z.infer<typeof DashQueueItem>;

/** A list row (assigned-to-me / recent records / needs-attention). */
export const DashRow = z.object({
  ref: DashRef,
  icon: z.string(),
  iconTone: z.enum(["danger", "info", "success", "warn", "accent", "muted"]).default("accent"),
  title: z.string(),
  sub: z.string(),
  status: z.object({ tone: z.string(), label: z.string() }).optional(),
});
export type DashRow = z.infer<typeof DashRow>;

/** A teammate row on the Manager's "Team today". */
export const DashTeamMember = z.object({
  userId: z.string().uuid(),
  initials: z.string(),
  name: z.string(),
  summary: z.string(),
  online: z.boolean(),
});
export type DashTeamMember = z.infer<typeof DashTeamMember>;

/** An audit-log highlight row on the Admin pulse. */
export const DashAuditItem = z.object({
  id: z.string(),
  icon: z.string(),
  title: z.string(),
  detail: z.string(),
  at: z.string().datetime(),
});
export type DashAuditItem = z.infer<typeof DashAuditItem>;

const DashCommon = { kpis: z.array(DashKpi) };

/** Role-shaped dashboard. Discriminated by `variant`, which the server derives
 *  from the caller's membership role (auditor is served the viewer shape). */
export const DashboardDto = z.discriminatedUnion("variant", [
  z.object({
    variant: z.literal("inspector"),
    ...DashCommon,
    queue: z.array(DashQueueItem),
    assigned: z.array(DashRow),
  }),
  z.object({
    variant: z.literal("viewer"),
    ...DashCommon,
    recent: z.array(DashRow),
  }),
  z.object({
    variant: z.literal("manager"),
    ...DashCommon,
    approvals: z.object({
      documents: z.number().int().nonnegative(),
      ncrDispositions: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
    team: z.array(DashTeamMember),
  }),
  z.object({
    variant: z.literal("admin"),
    ...DashCommon,
    needsAttention: z.array(DashRow),
    auditHighlights: z.array(DashAuditItem),
  }),
]);
export type DashboardDto = z.infer<typeof DashboardDto>;

// ── Delta sync (05 §2.1) ─────────────────────────────────────────────────────
// The mobile offline engine pulls each synced entity through ONE delta endpoint:
// rows changed since an opaque cursor, plus tombstoned ids, plus the next cursor
// to persist. `changed` carries the full DTO; `deleted` carries ids only. This
// replaces the O(changed) list-walk fallback with an O(delta) `updated_at` keyset
// scan, and lets deletions reconcile incrementally instead of on a full refresh.
export const SyncQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type SyncQuery = z.infer<typeof SyncQuery>;

// `nextCursor` always marks the LAST row seen so the client can resume strictly
// after it next cycle (never re-pulling from zero); `hasMore` says whether more
// changed rows are waiting right now, so the client keeps paging until it clears.
const SyncDeltaBase = {
  deleted: z.array(z.string().uuid()),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
};

export const NcrSyncDelta = z.object({ changed: z.array(NcrDto), ...SyncDeltaBase });
export type NcrSyncDelta = z.infer<typeof NcrSyncDelta>;

export const InspectionSyncDelta = z.object({ changed: z.array(InspectionDto), ...SyncDeltaBase });
export type InspectionSyncDelta = z.infer<typeof InspectionSyncDelta>;

// A device reports its current sync health for the signed-in workspace (05 §M5),
// so the admin dashboard's "Failed syncs" tile has a real, tenant-wide source
// instead of "—". `failed`/`needsReview` are the engine's parked-write counters.
export const SyncHealthBody = z.object({
  deviceId: z.string().min(1).max(128),
  failed: z.number().int().min(0),
  needsReview: z.number().int().min(0),
  lastSyncedAt: z.string().datetime().nullable().optional(),
});
export type SyncHealthBody = z.infer<typeof SyncHealthBody>;

// --- Predictive risk (Sprint 03 Part B, §3B) --------------------------------

/**
 * One (subject, horizon) forecast row — the shape `LeadRow`/`ForecastSpark`
 * render. `level` and `subjectName` are computed at read time (not stored):
 * `level` from `packages/core`'s `riskLevel(predictedValue, history, ...)`,
 * `subjectName` joined from `areas.name`/`suppliers.name`. `modelVersion` and
 * `generatedAt` are always present — predictions are advisory, never shown as
 * unattributed fact (P2 AC2).
 */
export const RiskPredictionDto = z.object({
  id: z.string().uuid(),
  subjectKind: PredictionSubjectKind,
  subjectId: z.string().uuid(),
  subjectName: z.string().nullable(),
  horizon: z.string(),
  predictedValue: z.number(),
  confidence: z.number().int().min(0).max(100),
  bandLow: z.number(),
  bandHigh: z.number(),
  history: z.array(z.number()),
  level: PredictionRiskLevel,
  reasoning: z.string(),
  modelVersion: z.string(),
  generatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type RiskPredictionDto = z.infer<typeof RiskPredictionDto>;

export const PredictionListQuery = PageQuery.extend({
  subjectKind: PredictionSubjectKind.optional(),
  horizon: z.string().min(1).max(32).optional(),
  /** Ranked list (predicted_value desc) vs. the default recency order. */
  order: z.enum(["predicted_value", "created_at"]).optional(),
});
export type PredictionListQuery = z.infer<typeof PredictionListQuery>;

/** One subject's full set of horizon rows — feeds the detail spark. */
export const PredictionDetailResponse = z.object({
  subjectKind: PredictionSubjectKind,
  subjectId: z.string().uuid(),
  subjectName: z.string().nullable(),
  predictions: z.array(RiskPredictionDto),
});
export type PredictionDetailResponse = z.infer<typeof PredictionDetailResponse>;

// --- Risk register (SPRINT-04 R1/R2; qms-risk-spc.jsx `RiskRegister`) -------
// A 5×5 likelihood×impact register (`packages/core/risk-matrix.ts` computes
// score bands + heat-map counts, never this file). `inherentScore` is DB-
// derived (`likelihood * impact`, GENERATED ALWAYS); `residualScore` is the
// risk owner's own independently-entered judgment call (§3.1) — never derived
// here. Managed under `risk:manage`, read under `risk:view`; optimistic +
// audited. `controls[]` is a full-array-replace sub-list (R2 AC2), not its
// own routes — mirrors the parent resource owning its child rows the way
// `fmea_items` are owned by their FMEA, but folded into the same PATCH here
// rather than a child route, per R2 AC2's explicit design.

export const RiskCategory = z.enum([
  "supply",
  "process",
  "compliance",
  "cyber",
  "people",
  "quality",
  "environmental",
  "financial",
  "reputation",
]);
export type RiskCategory = z.infer<typeof RiskCategory>;

export const RiskTreatment = z.enum(["mitigate", "accept", "transfer", "avoid"]);
export type RiskTreatment = z.infer<typeof RiskTreatment>;

export const RiskTrend = z.enum(["up", "down", "flat"]);
export type RiskTrend = z.infer<typeof RiskTrend>;

export const RiskRegisterStatus = z.enum(["active", "monitoring", "accepted"]);
export type RiskRegisterStatus = z.infer<typeof RiskRegisterStatus>;

export const RiskControlKind = z.enum(["detective", "preventive", "corrective", "contingency"]);
export type RiskControlKind = z.infer<typeof RiskControlKind>;

export const RiskControlStrength = z.enum(["strong", "medium", "weak"]);
export type RiskControlStrength = z.infer<typeof RiskControlStrength>;

/** One risk_controls row, as read (R2 AC1). */
export const RiskControlDto = z.object({
  id: z.string().uuid(),
  kind: RiskControlKind,
  description: z.string(),
  strength: RiskControlStrength,
  seq: z.number().int().nonnegative(),
});
export type RiskControlDto = z.infer<typeof RiskControlDto>;

/**
 * One control row as sent in `UpdateRiskBody.controls` (R2 AC2's full-array
 * replace). `id` present keeps an existing row's identity across the replace
 * (so its own `created_at`/history aren't lost); omitted for a new row the
 * server assigns an id to. The whole array replaces the risk's controls in
 * one transaction, in `seq` order (R2 AC3).
 */
export const RiskControlInput = z.object({
  id: z.string().uuid().optional(),
  kind: RiskControlKind,
  description: z.string().trim().min(1).max(2000),
  strength: RiskControlStrength,
  seq: z.number().int().nonnegative().default(0),
});
export type RiskControlInput = z.infer<typeof RiskControlInput>;

export const RiskDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  category: RiskCategory,
  title: z.string(),
  owner: z.string().uuid(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  /** `likelihood × impact`, DB-derived — never independently set. */
  inherentScore: z.number().int().min(1).max(25),
  residualScore: z.number().int().min(1).max(25),
  trend: RiskTrend,
  treatment: RiskTreatment,
  status: RiskRegisterStatus,
  plan: z.string(),
  reviewDue: DateOnly.nullable(),
  controls: z.array(RiskControlDto),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RiskDto = z.infer<typeof RiskDto>;

export const RiskListQuery = PageQuery.extend({
  category: RiskCategory.optional(),
  status: RiskRegisterStatus.optional(),
  treatment: RiskTreatment.optional(),
  owner: z.string().uuid().optional(),
  likelihood: z.coerce.number().int().min(1).max(5).optional(),
  impact: z.coerce.number().int().min(1).max(5).optional(),
  /**
   * Batch-resolve a fixed set of risks by id, comma-separated (R1's
   * `[AMENDED-2]` addition — feeds FMEA's reverse-pane label lookup, R3 AC7).
   * Parsed to a deduplicated array of uuids server-side; never a substring or
   * free-text search.
   */
  ids: z
    .string()
    .max(4000)
    .transform((s) =>
      Array.from(new Set(s.split(",").map((v) => v.trim()).filter((v) => v.length > 0))),
    )
    .pipe(z.array(z.string().uuid()).max(100))
    .optional(),
});
export type RiskListQuery = z.infer<typeof RiskListQuery>;

/** Create-time fields (R1 AC3, R4 AC1). Fields the wizard doesn't capture get
 *  their R4 AC1 defaults here, so both the full edit surface and the wizard's
 *  minimal surface post the same shape. `residualScore` omitted defaults to
 *  `likelihood × impact` (the not-yet-scored inherent value) — the service
 *  computes that default server-side since it must match the DB's own
 *  GENERATED `inherent_score`, never a client-computed guess. */
export const CreateRiskBody = z.object({
  category: RiskCategory,
  title: z.string().trim().min(1).max(200),
  owner: z.string().uuid(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  residualScore: z.number().int().min(1).max(25).optional(),
  trend: RiskTrend.default("flat"),
  treatment: RiskTreatment,
  status: RiskRegisterStatus.default("active"),
  plan: z.string().trim().max(4000).default(""),
  reviewDue: DateOnly.nullable().optional(),
});
export type CreateRiskBody = z.infer<typeof CreateRiskBody>;

/** Full edit surface (R1 UC "Edit / Re-score both open the same edit
 *  surface") — every field is re-sent, optimistic via `lockVersion`. Controls
 *  are an optional full-array replace (R2 AC2); omitted leaves the risk's
 *  existing controls untouched. */
export const UpdateRiskBody = z.object({
  category: RiskCategory,
  title: z.string().trim().min(1).max(200),
  owner: z.string().uuid(),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  residualScore: z.number().int().min(1).max(25),
  trend: RiskTrend,
  treatment: RiskTreatment,
  status: RiskRegisterStatus,
  plan: z.string().trim().max(4000),
  reviewDue: DateOnly.nullable(),
  controls: z.array(RiskControlInput).max(50).optional(),
  lockVersion: z.number().int().nonnegative(),
});
export type UpdateRiskBody = z.infer<typeof UpdateRiskBody>;

/**
 * Unpaginated register-wide aggregate (SPRINT-04 R1, architect-flagged
 * addition to §4's route table — the KPI strip/heat-map/category panel need
 * counts across ALL of a tenant's risks, which a cursor-paginated list
 * cannot supply without violating rule 6). Every count is computed from the
 * caller's own RLS-scoped `risks` rows; a zero-risk tenant returns all-zero
 * counts and `reviewedThisQuarterPct: null` (never `0`/`NaN` — R1 AC6's
 * "—" empty-state formula).
 */
export const RiskSummaryDto = z.object({
  total: z.number().int().nonnegative(),
  /** Keyed by `RiskCategory`; only categories with ≥1 risk are present (R1 AC5 — no hard-capped/zero-filled list). */
  byCategory: z.record(z.string(), z.number().int().nonnegative()),
  byBand: z.object({
    low: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
  }),
  /** `scoreBand(residualScore) in ("high","critical")`, i.e. `residualScore >= 10` (R1 AC6). */
  highResidual: z.number().int().nonnegative(),
  /** `review_due IS NOT NULL AND review_due < current_date` (R1 AC6). */
  treatmentsOverdue: z.number().int().nonnegative(),
  /** `status = 'accepted'` (R1 AC6). */
  accepted: z.number().int().nonnegative(),
  /** `100 × distinct risks with a created/updated audit_events row this
   *  calendar quarter / total`; `null` when `total === 0` (R1 AC6's "—"). */
  reviewedThisQuarterPct: z.number().min(0).max(100).nullable(),
});
export type RiskSummaryDto = z.infer<typeof RiskSummaryDto>;

// --- MSA / Gauge R&R (SPRINT-04 M1-M5; qms-risk-spc.jsx `MSAStudy`) ---------
// AIAG 4th-edition Gauge R&R studies. The variance-component math itself is
// `packages/core/gauge-rr.ts` (pure, unit-tested); these DTOs mirror its real
// `GaugeRrResult`/`MsaMethod`/`GaugeRrVerdict` shapes exactly (read at build
// time, not guessed) so the wire format never drifts from the math. The
// analysis is NEVER stored pre-computed (M1 AC3) — `MsaAnalysisResult` is a
// discriminated union so an incomplete study's "needs N more measurements"
// state is a real, honest shape, not a fabricated zeroed result.

export const MsaMethod = z.enum(["crossed_anova", "average_range"]);
export type MsaMethod = z.infer<typeof MsaMethod>;

export const MsaStudyStatus = z.enum(["draft", "completed"]);
export type MsaStudyStatus = z.infer<typeof MsaStudyStatus>;

export const GaugeRrVerdict = z.enum(["excellent", "acceptable", "reject"]);
export type GaugeRrVerdict = z.infer<typeof GaugeRrVerdict>;

/** One `msa_measurements` grid cell, 1-based on every axis (matches
 *  `packages/core/gauge-rr.ts`'s `GaugeRrMeasurement`). */
export const MsaMeasurementDto = z.object({
  appraiser: z.number().int().positive(),
  part: z.number().int().positive(),
  trial: z.number().int().positive(),
  value: z.number(),
});
export type MsaMeasurementDto = z.infer<typeof MsaMeasurementDto>;

export const MsaStudyDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  characteristic: z.string(),
  gaugeLabel: z.string(),
  method: MsaMethod,
  nAppraisers: z.number().int().positive(),
  nParts: z.number().int().positive(),
  nTrials: z.number().int().positive(),
  /** `null` when the study declares no tolerance — `%Tolerance` reads "—". */
  tolerance: z.number().positive().nullable(),
  status: MsaStudyStatus,
  /** Set on first `draft→completed`; overwritten (not cleared) by a later
   *  reopen + re-complete cycle (§3-Addendum). */
  completedAt: z.string().datetime().nullable(),
  owner: z.string().uuid(),
  /** The grid's current cells — there is no separate list route (§4's route
   *  table), so the study detail read is also the grid's data source. */
  measurements: z.array(MsaMeasurementDto),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MsaStudyDto = z.infer<typeof MsaStudyDto>;

/**
 * `nAppraisers`/`nParts`/`nTrials`/`method`/`gaugeLabel`/`tolerance`/
 * `characteristic` are immutable after creation (M2 AC3) — this is the ONLY
 * body that ever sets them. Bounds (M1 AC4/AC5, M2 AC4), both methods, both
 * layers: the shared upper cap (10/50/10) is enforced directly in the shape
 * below; the method-keyed lower bounds are enforced by the `.superRefine`
 * below it (Zod's mechanism for a cross-field rule keyed on another field —
 * the "refine keyed on `method`" this slice's brief asks for). The per-study
 * range check against a study's *own* declared dimensions (for the
 * measurement-batch route) needs the DB row and is NOT here — that's
 * `MsaService`'s concern (next slice), since Zod cannot see database state.
 */
export const CreateMsaStudyBody = z
  .object({
    characteristic: z.string().trim().min(1).max(200),
    gaugeLabel: z.string().trim().min(1).max(200),
    method: MsaMethod,
    nAppraisers: z.number().int().min(1).max(10),
    nParts: z.number().int().min(1).max(50),
    nTrials: z.number().int().min(1).max(10),
    tolerance: z.number().positive().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.method === "average_range") {
      if (val.nTrials !== 2 && val.nTrials !== 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nTrials"],
          message: "average_range requires 2 or 3 trials",
        });
      }
      if (val.nAppraisers !== 2 && val.nAppraisers !== 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nAppraisers"],
          message: "average_range requires 2 or 3 appraisers",
        });
      }
      if (val.nParts < 2 || val.nParts > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nParts"],
          message: "average_range requires 2-10 parts",
        });
      }
    } else {
      if (val.nAppraisers < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nAppraisers"],
          message: "crossed_anova requires at least 2 appraisers",
        });
      }
      if (val.nParts < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nParts"],
          message: "crossed_anova requires at least 2 parts",
        });
      }
      if (val.nTrials < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nTrials"],
          message: "crossed_anova requires at least 2 trials",
        });
      }
    }
  });
export type CreateMsaStudyBody = z.infer<typeof CreateMsaStudyBody>;

export const MsaListQuery = PageQuery.extend({
  status: MsaStudyStatus.optional(),
  method: MsaMethod.optional(),
});
export type MsaListQuery = z.infer<typeof MsaListQuery>;

/**
 * `POST .../measurements` batch body (M2 AC2, `[AMENDED-4]`) — `{ lockVersion,
 * cells }`, not a bare array, so the batch closes the same-version race with
 * a concurrent completion (409 on stale `lockVersion`). Each cell's index is
 * bounds-checked here only against the GLOBAL cap (10/50/10) — the per-study
 * check against this study's own declared `nAppraisers`/`nParts`/`nTrials`
 * needs the DB row and belongs in `MsaService` (next slice), not here.
 */
export const MsaMeasurementCellInput = z.object({
  appraiser: z.number().int().min(1).max(10),
  part: z.number().int().min(1).max(50),
  trial: z.number().int().min(1).max(10),
  value: z.number(),
});
export type MsaMeasurementCellInput = z.infer<typeof MsaMeasurementCellInput>;

export const MsaMeasurementBatchBody = z.object({
  lockVersion: z.number().int().nonnegative(),
  /** Hard ceiling: 10×50×10, the shared upper cap's worst case. */
  cells: z.array(MsaMeasurementCellInput).min(1).max(5000),
});
export type MsaMeasurementBatchBody = z.infer<typeof MsaMeasurementBatchBody>;

/**
 * `draft → completed` (M2 AC3, `[AMENDED-4]`) — `.strict()`: exactly
 * `{ status: "completed", lockVersion }`, nothing else (dimensions are
 * immutable, see `CreateMsaStudyBody`'s doc comment). An extra field is a 422,
 * never silently dropped.
 */
export const MsaCompleteBody = z
  .object({
    status: z.literal("completed"),
    lockVersion: z.number().int().nonnegative(),
  })
  .strict();
export type MsaCompleteBody = z.infer<typeof MsaCompleteBody>;

/** `completed → draft` (M2 AC5, `[AMENDED-2]`) — optimistic via `lockVersion`,
 *  same as every other status-transition route in this sprint. `.strict()`
 *  for the same reason as `MsaCompleteBody`: a reopen changes only `status`. */
export const MsaReopenBody = z.object({ lockVersion: z.number().int().nonnegative() }).strict();
export type MsaReopenBody = z.infer<typeof MsaReopenBody>;

/** One variance source's row (EV/AV/GRR/PV/Total) — mirrors
 *  `packages/core/gauge-rr.ts`'s `GaugeRrSourceResult` exactly. */
export const MsaGaugeRrSourceDto = z.object({
  stdDev: z.number(),
  studyVariation: z.number(),
  pctStudyVar: z.number(),
  /** `null` when the study has no declared tolerance — never a fabricated number or ÷0. */
  pctTolerance: z.number().nullable(),
});
export type MsaGaugeRrSourceDto = z.infer<typeof MsaGaugeRrSourceDto>;

/** A study that cannot be analyzed yet (M1 UC "incomplete study") — an honest
 *  empty state, never a divide-by-zero or a fabricated result. */
export const MsaAnalysisIncomplete = z.object({
  status: z.literal("incomplete"),
  measurementsEntered: z.number().int().nonnegative(),
  measurementsRequired: z.number().int().positive(),
});
export type MsaAnalysisIncomplete = z.infer<typeof MsaAnalysisIncomplete>;

/** Mirrors `packages/core/gauge-rr.ts`'s `GaugeRrResult` field-for-field. */
export const MsaAnalysisComplete = z.object({
  status: z.literal("complete"),
  method: MsaMethod,
  repeatability: MsaGaugeRrSourceDto,
  /** `crossed_anova` only; `null` for `average_range`. */
  appraiser: MsaGaugeRrSourceDto.nullable(),
  /** `crossed_anova` only; `null` for `average_range`. */
  appraiserByPart: MsaGaugeRrSourceDto.nullable(),
  reproducibility: MsaGaugeRrSourceDto,
  grr: MsaGaugeRrSourceDto,
  partToPart: MsaGaugeRrSourceDto,
  total: MsaGaugeRrSourceDto,
  ndc: z.number(),
  verdict: GaugeRrVerdict,
  /** `null` for `average_range`, which has no interaction term to pool. */
  interactionPooled: z.boolean().nullable(),
});
export type MsaAnalysisComplete = z.infer<typeof MsaAnalysisComplete>;

/** `GET /v1/msa-studies/:id/analysis` (M1 AC3) — always recomputed from the
 *  study's real measurements, never stored pre-computed. */
export const MsaAnalysisResult = z.discriminatedUnion("status", [
  MsaAnalysisIncomplete,
  MsaAnalysisComplete,
]);
export type MsaAnalysisResult = z.infer<typeof MsaAnalysisResult>;

// =============================================================================
// Calibration management (Sprint 05 C1-C6; qms-modules.jsx `CalibrationManagement`)
// =============================================================================
// `dueStatus`/cell-state math itself is `packages/core/calibration.ts` (pure,
// unit-tested, ISO-date-string signature, B4) — these DTOs mirror it exactly.
// `next_due`/`expires_at` are real Postgres GENERATED columns (migration
// 0068/0069); `DateOnly` (`YYYY-MM-DD`) is used everywhere a `date` column
// crosses the wire, matching `packages/core`'s own ISO-date convention (never
// a JS `Date`/full datetime for a pure calendar date).

/** Derived, never stored (C1 AC2) — mirrors `packages/core/calibration.ts`'s
 *  `InstrumentDueStatus` exactly. */
export const InstrumentDueStatus = z.enum(["ok", "warn", "overdue", "unscheduled"]);
export type InstrumentDueStatus = z.infer<typeof InstrumentDueStatus>;

export const InstrumentDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: InstrumentType,
  plantId: z.string().uuid(),
  areaId: z.string().uuid().nullable(),
  /** Free text (e.g. "Internal — ISO 10360", "External — NABL accredited"). */
  method: z.string(),
  /** Free text display string (e.g. "±1.7μm") — nothing computes against it. */
  tolerance: z.string(),
  intervalMonths: z.number().int().positive(),
  lastCalibrated: DateOnly.nullable(),
  /** GENERATED column; `null` until the first calibration event (C6). */
  nextDue: DateOnly.nullable(),
  /** Always the newest event's own result (C2 AC2's tie-break), regardless of
   *  whether that event advanced `lastCalibrated`/`nextDue` (B3). */
  lastResult: CalibrationResult.nullable(),
  owner: z.string().uuid().nullable(),
  status: InstrumentLifecycleStatus,
  /** Derived server-side from `instrumentDueStatus` — never independently set. */
  dueStatus: InstrumentDueStatus,
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InstrumentDto = z.infer<typeof InstrumentDto>;

/** `GET /v1/instruments` (C1 AC3). `dueStatus` here is a coarser list filter
 *  (`due_soon`|`overdue`) than the DTO's own 4-state `InstrumentDueStatus` —
 *  `unscheduled`/`ok` aren't filterable states a register search asks for. */
export const InstrumentListQuery = PageQuery.extend({
  type: InstrumentType.optional(),
  status: InstrumentLifecycleStatus.optional(),
  dueStatus: z.enum(["due_soon", "overdue"]).optional(),
  plantId: z.string().uuid().optional(),
  /** Free-text search over name/code/area name (C1 AC3, SF5). */
  q: z.string().trim().min(1).max(200).optional(),
});
export type InstrumentListQuery = z.infer<typeof InstrumentListQuery>;

/** C6 AC1-3 — `status` defaults to `active`; `lastCalibrated`/`nextDue` are
 *  `NULL` until the first calibration event, never client-supplied here. */
export const CreateInstrumentBody = z.object({
  name: z.string().trim().min(1).max(200),
  type: InstrumentType,
  plantId: z.string().uuid(),
  areaId: z.string().uuid().nullable().optional(),
  method: z.string().trim().min(1).max(500),
  tolerance: z.string().trim().min(1).max(200),
  intervalMonths: z.number().int().positive(),
  owner: z.string().uuid().nullable().optional(),
});
export type CreateInstrumentBody = z.infer<typeof CreateInstrumentBody>;

/**
 * `PATCH /v1/instruments/:id` (C1 AC3) — a true partial update (every field
 * but `lockVersion` optional): edits name/type/plant/area/method/tolerance/
 * interval/owner. Never accepts `lastCalibrated`/`nextDue`/`lastResult`/
 * `status` directly — those change only via a calibration event (C2) or the
 * dedicated retire route (C4 AC1). Transfer (C4 AC2) is this same route with
 * only `plantId`/`areaId` set — the service checks the target `areaId`
 * actually belongs to the target `plantId` when both are present.
 */
export const UpdateInstrumentBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: InstrumentType.optional(),
  plantId: z.string().uuid().optional(),
  areaId: z.string().uuid().nullable().optional(),
  method: z.string().trim().min(1).max(500).optional(),
  tolerance: z.string().trim().min(1).max(200).optional(),
  intervalMonths: z.number().int().positive().optional(),
  owner: z.string().uuid().nullable().optional(),
  lockVersion: z.number().int().nonnegative(),
});
export type UpdateInstrumentBody = z.infer<typeof UpdateInstrumentBody>;

/** `PATCH /v1/instruments/:id/retire` (C4 AC1) — one-way `active -> retired`;
 *  422 if already retired. `.strict()` since retiring changes only `status`. */
export const RetireInstrumentBody = z.object({ lockVersion: z.number().int().nonnegative() }).strict();
export type RetireInstrumentBody = z.infer<typeof RetireInstrumentBody>;

/** `GET /v1/instruments/summary` (C1 AC6) — the KPI strip's four numbers,
 *  precomputed server-side (a cursor-paginated list cannot supply a tenant
 *  total, rule 6). Plant-scoped identically to the list route; does NOT carry
 *  the owner-sees-own-instrument exception (§3.1 item 3). */
export const InstrumentSummaryDto = z.object({
  /** `count(*) where status='active'` (C1 AC5). */
  instrumentsTracked: z.number().int().nonnegative(),
  /** `count(*) where status='active' and dueStatus='warn'` (C1 AC5). */
  dueSoon: z.number().int().nonnegative(),
  /** `count(*) where status='active' and dueStatus='overdue'` — includes
   *  every `last_result='fail'` instrument regardless of `nextDue` (B3). */
  overdue: z.number().int().nonnegative(),
  /** `count(*) from calibration_events where result in ('adjusted','fail')
   *  and performed_at in the tenant's current calendar year` (C1 AC5). */
  outOfToleranceFindingsYtd: z.number().int().nonnegative(),
  /** Sub-stat: how many of the above already have a linked NCR (C3). */
  outOfToleranceLedToNcrYtd: z.number().int().nonnegative(),
});
export type InstrumentSummaryDto = z.infer<typeof InstrumentSummaryDto>;

export const CalibrationEventDto = z.object({
  id: z.string().uuid(),
  instrumentId: z.string().uuid(),
  performedAt: DateOnly,
  result: CalibrationResult,
  /** Free text — an external lab name or an internal technician (C2 AC1). */
  performedBy: z.string(),
  notes: z.string(),
  /** Sole, authoritative link to a certificate (§3.1 item 16, B7) — never
   *  resolved via `files.entityKind`/`entityId`. */
  certificateFileId: z.string().uuid().nullable(),
  /** Set once, by C3's raise-NCR route only. */
  ncrId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CalibrationEventDto = z.infer<typeof CalibrationEventDto>;

/**
 * `POST /v1/instruments/:id/calibration-events` (C2 AC2) — `lockVersion`
 * guards the parent instrument's optimistic-concurrency write (the same
 * `UPDATE` that advances `lastCalibrated`/`nextDue` for `pass`/`adjusted`, or
 * just mirrors `lastResult` for `fail`, C2 AC2/BLOCKING 1). `performedAt`
 * strictly after today (server UTC) is rejected 422 here as a coarse guard;
 * the service re-checks exactly against the instrument's own plant timezone
 * (C2 AC7, B4(c)). `certificateFileId` inline-links a file already
 * presigned/uploaded/completed with `entityKind: "calibration_event"` and
 * `entityId` omitted (C2 AC4) — never a fresh upload target itself.
 */
export const CreateCalibrationEventBody = z.object({
  performedAt: notFutureDate("performedAt"),
  result: CalibrationResult,
  performedBy: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(4000).default(""),
  certificateFileId: z.string().uuid().nullable().optional(),
  lockVersion: z.number().int().nonnegative(),
});
export type CreateCalibrationEventBody = z.infer<typeof CreateCalibrationEventBody>;

export const CalibrationEventListQuery = PageQuery.extend({});
export type CalibrationEventListQuery = z.infer<typeof CalibrationEventListQuery>;

/** `PUT /v1/instruments/:instrumentId/calibration-events/:eventId/certificate`
 *  (C2 AC5) — attach/replace a certificate after the fact; same tenant +
 *  `sha256 IS NOT NULL` + `entityKind='calibration_event'` +
 *  `deletedAt IS NULL` verification as the inline flow (AC4). */
export const AttachCertificateBody = z.object({ fileId: z.string().uuid() });
export type AttachCertificateBody = z.infer<typeof AttachCertificateBody>;

/** `POST /v1/instruments/:instrumentId/calibration-events/:eventId/raise-ncr`
 *  (C3 AC2) — no client-supplied fields; the NCR's title/plantId are derived
 *  server-side from the instrument + event. 422 if the event's
 *  `result = 'pass'`; 409 if `ncrId` is already set. */
export const RaiseNcrFromCalibrationBody = z.object({}).strict();
export type RaiseNcrFromCalibrationBody = z.infer<typeof RaiseNcrFromCalibrationBody>;

// =============================================================================
// Training & competency (Sprint 05 T1-T5; qms-modules.jsx `TrainingMatrix`)
// =============================================================================
// Cell-state math itself is `packages/core/competency.ts` (pure, unit-tested,
// ISO-date-string signature, B4) — `TrainingMatrixCellDto.state` mirrors its
// `CompetencyCellState` return type exactly.

export const CompetencyDto = z.object({
  id: z.string().uuid(),
  /** Author-chosen slug (e.g. "iatf", "fmea") — NOT counters-sequenced. */
  code: z.string(),
  name: z.string(),
  mandatory: z.boolean(),
  /** `null` = never expires. */
  validMonths: z.number().int().positive().nullable(),
  /** Matrix column order. */
  seq: z.number().int().nonnegative(),
  /** `null` when not archived; T5's dedicated marker, never the generic
   *  soft-delete `deletedAt`. */
  archivedAt: z.string().datetime().nullable(),
  /** `count(distinct member_id) from training_records where competency_id =
   *  :id` — live, never stored; what Board 9's archive-confirm dialog reads
   *  (T1 AC9, BLOCKING A). */
  trainingRecordCount: z.number().int().nonnegative(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CompetencyDto = z.infer<typeof CompetencyDto>;

/** `GET /v1/competencies` (T1 AC3) — excludes archived rows by default;
 *  `status=archived` finds them (T5 AC2). */
export const CompetencyListQuery = PageQuery.extend({
  status: z.enum(["active", "archived"]).optional(),
});
export type CompetencyListQuery = z.infer<typeof CompetencyListQuery>;

/** `POST /v1/competencies` (T1 AC3) — `seq` is always server-assigned
 *  (`current_max_seq(non-archived) + 1`), never client-supplied. A `code`
 *  clash against a non-archived competency is `409 Conflict`
 *  (`[AMENDED-4]` SHOULD-FIX 8(c)). */
export const CreateCompetencyBody = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  mandatory: z.boolean().default(false),
  validMonths: z.number().int().positive().nullable().optional(),
});
export type CreateCompetencyBody = z.infer<typeof CreateCompetencyBody>;

/** `PATCH /v1/competencies/:id` (T1 AC3) — partial update, `lockVersion`-
 *  guarded. Flipping `mandatory` never retroactively rewrites
 *  `training_records` — cell state is always derived live (T5 UC). */
export const UpdateCompetencyBody = z.object({
  code: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  mandatory: z.boolean().optional(),
  validMonths: z.number().int().positive().nullable().optional(),
  lockVersion: z.number().int().nonnegative(),
});
export type UpdateCompetencyBody = z.infer<typeof UpdateCompetencyBody>;

/** `PATCH /v1/competencies/:id/archive` (T5 AC1) — sets `archivedAt = now()`;
 *  422 if already archived. `.strict()`: archiving changes only `archivedAt`. */
export const ArchiveCompetencyBody = z.object({ lockVersion: z.number().int().nonnegative() }).strict();
export type ArchiveCompetencyBody = z.infer<typeof ArchiveCompetencyBody>;

/** `PATCH /v1/competencies/:id/unarchive` (T5 AC1(b)) — clears `archivedAt`
 *  and resets `seq = current_max_seq(non-archived) + 1`; 422 if not archived;
 *  409 on a `code` clash against a non-archived row (T5 AC1(c)). */
export const UnarchiveCompetencyBody = z.object({ lockVersion: z.number().int().nonnegative() }).strict();
export type UnarchiveCompetencyBody = z.infer<typeof UnarchiveCompetencyBody>;

/**
 * `PUT /v1/competencies/order` (T5 AC3, `[AMENDED-4]` SHOULD-FIX 8(a)) — an
 * explicitly-ordered array of every non-archived competency's id; array
 * position (0-indexed) becomes the new `seq`. No client-supplied `seq`, so
 * there is no duplicate-`seq` question — a repeated id is rejected here
 * (schema-level: no duplicates within the submitted array). The service
 * separately 409s when this array's id SET doesn't exactly match the
 * current non-archived set (`ids.length === count(non-archived) &&
 * new Set(ids).size === ids.length` — the architecture review's own named
 * correction: comparing set equality alone would silently accept a body that
 * duplicates one id in place of a missing one, since a `Set` collapses the
 * duplicate and can appear to "match" a same-size distinct set). That
 * DB-count comparison needs the current row count and so belongs in the
 * service, not this schema — this schema only rejects a duplicate id within
 * the submitted array itself, which no valid ordering could ever contain.
 */
export const ReorderCompetenciesBody = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max(2000)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "ids must not contain duplicates",
    }),
});
export type ReorderCompetenciesBody = z.infer<typeof ReorderCompetenciesBody>;

/** `PUT /v1/competencies/order`'s response — the full, non-archived catalog
 *  in its new `seq` order; a plain array wrapper, not `page()`'s cursor shape
 *  (this route is a single atomic reorder, not a paginated list). */
export const ReorderCompetenciesResult = z.object({ items: z.array(CompetencyDto) });
export type ReorderCompetenciesResult = z.infer<typeof ReorderCompetenciesResult>;

export const TrainingRecordDto = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  competencyId: z.string().uuid(),
  completedAt: DateOnly,
  /** Copied from `competencies.validMonths` at insert time — never re-derived
   *  from the (possibly since-changed) catalog later (B1). */
  validMonths: z.number().int().positive().nullable(),
  /** GENERATED from `completedAt` + `validMonths`; `null` when `validMonths`
   *  is `null` (never expires). */
  expiresAt: DateOnly.nullable(),
  /** Sole, authoritative link to evidence — mirrors `certificateFileId`. */
  evidenceFileId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TrainingRecordDto = z.infer<typeof TrainingRecordDto>;

/**
 * `POST /v1/training/records` (T2 AC1) — one all-or-nothing batch: one new
 * history row per `memberId`, each copying `competencies.validMonths` at
 * insert time (T1 AC1). `evidenceFileId`, once set, is shared across every
 * row this call creates — the client presigns with `entityKind:
 * "training_batch"` and `entityId` omitted, uploads, completes, THEN calls
 * this route with that file's real id (T2 AC2, BLOCKING 2 — the
 * `training_batch_id` concept was dropped, unbuildable as originally
 * specified). `completedAt` strictly after today (server UTC) is rejected
 * 422 here as a coarse guard; the service re-checks exactly against the
 * tenant's own timezone (T2 AC4, B4(c)).
 */
export const CreateTrainingRecordBody = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(500),
  competencyId: z.string().uuid(),
  completedAt: notFutureDate("completedAt"),
  evidenceFileId: z.string().uuid().nullable().optional(),
});
export type CreateTrainingRecordBody = z.infer<typeof CreateTrainingRecordBody>;

/** `POST /v1/training/records`'s response — one `TrainingRecordDto` per
 *  `memberId` in the request, all committed together (SF8) — a plain array
 *  wrapper, not `page()`'s cursor shape (this is a create response, not a
 *  paginated list). */
export const CreateTrainingRecordResult = z.object({ items: z.array(TrainingRecordDto) });
export type CreateTrainingRecordResult = z.infer<typeof CreateTrainingRecordResult>;

/** A single (member, competency) matrix cell's state — mirrors
 *  `packages/core/competency.ts`'s `CompetencyCellState` exactly. */
export const TrainingMatrixCellDto = z.object({
  competencyId: z.string().uuid(),
  state: z.enum(["ok", "warn", "overdue", "gap", "na"]),
  /** The record this state was derived from, if any (no record for `gap`/`na`). */
  recordId: z.string().uuid().nullable(),
  expiresAt: DateOnly.nullable(),
});
export type TrainingMatrixCellDto = z.infer<typeof TrainingMatrixCellDto>;

/** One member row of the matrix — the page item for `GET /v1/training/matrix`
 *  (T1 AC4, cursor over MEMBERS, not competencies). */
export const TrainingMatrixRowDto = z.object({
  memberId: z.string().uuid(),
  memberName: z.string(),
  /** `memberships.title` — the free-text job-title field (e.g. "CMM Specialist"). */
  title: z.string().nullable(),
  cells: z.array(TrainingMatrixCellDto),
});
export type TrainingMatrixRowDto = z.infer<typeof TrainingMatrixRowDto>;

/** `GET /v1/training/matrix` (T1 AC4) — `q` resolves via `control.users`
 *  (name search), never a denormalized name column (§3.1 item 5). */
export const TrainingMatrixQuery = PageQuery.extend({
  mandatoryOnly: z.coerce.boolean().optional(),
  gapsOnly: z.coerce.boolean().optional(),
  q: z.string().trim().min(1).max(200).optional(),
});
export type TrainingMatrixQuery = z.infer<typeof TrainingMatrixQuery>;

/** `GET /v1/training/summary` (T1 AC8) — the KPI strip's four numbers,
 *  precomputed server-side, plant-scoped identically to the matrix route. */
export const TrainingSummaryDto = z.object({
  /** `count(distinct member_id)` among active, non-partner, visible members. */
  membersTracked: z.number().int().nonnegative(),
  /** `100 × ok+warn / total` over (member, mandatory, non-archived-competency)
   *  pairs; `null` when the denominator is zero (SF9) — the API never emits
   *  the literal string `"—"`, that is the web layer's job for a `null`. */
  coverage: z.number().min(0).max(100).nullable(),
  /** `count(*) where state = 'warn'`, non-archived, not mandatory-only. */
  expiringSoon: z.number().int().nonnegative(),
  /** `count(*) where state in ('overdue','gap')`, non-archived. */
  overdue: z.number().int().nonnegative(),
});
export type TrainingSummaryDto = z.infer<typeof TrainingSummaryDto>;

/** `GET /v1/training/gaps` (T3 AC1) — every (member, non-archived competency)
 *  pair in state `gap`/`overdue`/`warn`, sorted worst-first. Same query the
 *  matrix's Gaps filter uses, exposed as its own route so the "Expiring &
 *  overdue" card and the skill-gap-report export don't have to paginate the
 *  full matrix. */
export const TrainingGapsQuery = PageQuery.extend({});
export type TrainingGapsQuery = z.infer<typeof TrainingGapsQuery>;

export const TrainingGapDto = z.object({
  memberId: z.string().uuid(),
  memberName: z.string(),
  competencyId: z.string().uuid(),
  competencyName: z.string(),
  state: z.enum(["gap", "overdue", "warn"]),
  expiresAt: DateOnly.nullable(),
});
export type TrainingGapDto = z.infer<typeof TrainingGapDto>;

/**
 * `GET /v1/training/records` (T1 AC9, `[AMENDED-4]` BLOCKING A) — a member's
 * full history, INCLUDING rows whose `competencyId` points at a now-archived
 * competency (the one training read path that deliberately does not apply
 * the `archivedAt IS NULL` predicate — T5's own history-preservation promise
 * depends on it). `memberId` is required. Visibility (enforced by the
 * service, not this schema): `training:manage` may fetch any member's;
 * `training:view`-only may fetch only their own (`memberId` must equal the
 * caller's own membership id, else `403`, not `404` — an intra-tenant
 * permission boundary, not rule 8's cross-tenant case).
 */
export const TrainingRecordsQuery = PageQuery.extend({
  memberId: z.string().uuid(),
  competencyId: z.string().uuid().optional(),
});
export type TrainingRecordsQuery = z.infer<typeof TrainingRecordsQuery>;

// --- Customer complaints (Sprint 06 C1-C4, P18) -----------------------------
//
// `customerColor`/`slaState` are computed on every read, never stored (§0
// S6/AC5 — this codebase's established norm for a cheap, derivable display
// value, `packages/core/customer-color.ts`/`complaint-sla.ts`).

export const ComplaintDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  customer: z.string(),
  /** Computed on read from `customer` — never persisted (§0 S6). */
  customerColor: z.string(),
  contact: z.string(),
  channel: ComplaintChannel,
  severity: ComplaintSeverity,
  status: ComplaintStatus,
  subject: z.string(),
  description: z.string(),
  batchRef: z.string().nullable(),
  receivedAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  costUsd: z.number().nullable(),
  /** Denormalized at creation (or re-derived on a `severity` edit, §0 B7c) —
   *  never looked up fresh from the matrix on read. */
  slaTargetHours: z.number().int().positive(),
  slaCloseTargetDays: z.number().int().positive(),
  /** Computed on every read via `complaintSlaState` — frozen at `closedAt`
   *  once set (§0 B7b), never independently persisted. */
  slaState: SlaState,
  owner: z.string().uuid(),
  ncrId: z.string().uuid().nullable(),
  eightDId: z.string().uuid().nullable(),
  capaId: z.string().uuid().nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ComplaintDto = z.infer<typeof ComplaintDto>;

/** `GET /v1/complaints` (§2 C1 AC2). `unlinked` matches `ncr_id IS NULL`
 *  specifically (the "Not linked to NCR" tab's own literal label, §0 B8d) —
 *  it deliberately does not also check `eight_d_id`/`capa_id`. */
export const ComplaintListQuery = PageQuery.extend({
  status: ComplaintStatus.optional(),
  severity: ComplaintSeverity.optional(),
  channel: ComplaintChannel.optional(),
  owner: z.string().uuid().optional(),
  unlinked: z.coerce.boolean().optional(),
  /** Free-text search over subject/description/customer (C1 AC1). */
  q: z.string().trim().min(1).max(200).optional(),
});
export type ComplaintListQuery = z.infer<typeof ComplaintListQuery>;

/**
 * `POST /v1/complaints` (§2 C1 AC2, C2 AC1). `contact`/`channel` are the two
 * fields added beyond `IntakeForm`'s own drawn dialog, flagged plainly, not
 * invented decoration (§1a/§3.1). `receivedAt` is never client-supplied —
 * always server-set to `now()` (C2 AC4). `attachmentFileIds` are linked
 * after server-side verification (tenant + `entity_kind='complaint'` +
 * `deleted_at IS NULL` + `sha256 IS NOT NULL`, C2 AC1).
 */
export const CreateComplaintBody = z.object({
  customer: z.string().trim().min(1).max(200),
  contact: z.string().trim().min(1).max(300),
  channel: ComplaintChannel,
  severity: ComplaintSeverity,
  subject: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).optional(),
  batchRef: z.string().trim().min(1).max(200).nullable().optional(),
  attachmentFileIds: z.array(z.string().uuid()).max(50).optional(),
});
export type CreateComplaintBody = z.infer<typeof CreateComplaintBody>;

/**
 * `PATCH /v1/complaints/:id` (§2 C1 AC2, revised §0 S4/B7c). Remains editable
 * after `closed` (unlike ECN's terminal-stage freeze) — closing a complaint
 * does not freeze it. Never accepts `status`/`ncrId`/`eightDId`/`capaId`/
 * `acknowledgedAt`/`closedAt`/`owner` — those change only via the dedicated
 * acknowledge/close/convert actions, or (owner) not at all this sprint (§0
 * S4). Changing `severity` re-derives `slaTargetHours`/`slaCloseTargetDays`
 * from the matrix server-side, in the same transaction (§0 B7c).
 */
export const UpdateComplaintBody = z.object({
  customer: z.string().trim().min(1).max(200).optional(),
  contact: z.string().trim().min(1).max(300).optional(),
  channel: ComplaintChannel.optional(),
  severity: ComplaintSeverity.optional(),
  subject: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(10_000).optional(),
  batchRef: z.string().trim().min(1).max(200).nullable().optional(),
  costUsd: z.number().nonnegative().nullable().optional(),
  lockVersion: z.number().int().nonnegative(),
});
export type UpdateComplaintBody = z.infer<typeof UpdateComplaintBody>;

/** `POST /v1/complaints/:id/acknowledge` (§2 C3 AC1) — 422 if
 *  `acknowledgedAt` is already set; `.strict()` since this action changes
 *  only `acknowledgedAt`. */
export const AcknowledgeComplaintBody = z.object({ lockVersion: z.number().int().nonnegative() }).strict();
export type AcknowledgeComplaintBody = z.infer<typeof AcknowledgeComplaintBody>;

/** `POST /v1/complaints/:id/close` (§2 C3 AC2) — 422 if already `closed`. */
export const CloseComplaintBody = z.object({ lockVersion: z.number().int().nonnegative() }).strict();
export type CloseComplaintBody = z.infer<typeof CloseComplaintBody>;

/**
 * `POST /v1/complaints/:id/convert` (§2 C4 AC1, discriminated union keyed on
 * `target` — §0 B6g's fix). `priority`/`source`/`sourceId` are never
 * client-supplied: they are derived from severity (`packages/core/state-
 * machines/complaint.ts`'s mapping functions) or set internally by
 * `ComplaintsService.convert`, exactly as `raiseNcr`/`raiseCapa` already do
 * today (§0 B6h). Each variant is `.strict()` so a body carrying, say, both
 * `title` and `existingNcrId` for `target: "ncr"` is rejected rather than
 * silently matching the wrong branch.
 */
const ComplaintConvertToNcrCreate = z
  .object({
    target: z.literal("ncr"),
    lockVersion: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(300).optional(),
  })
  .strict();

/** Link to an existing NCR (§0 B8c, added back) — `existingNcrId` must be
 *  `ncr:view`-visible to the caller (tenant-scoped, 404 not 403 on a foreign
 *  id, rule 8); no new NCR is created. */
const ComplaintConvertToExistingNcr = z
  .object({
    target: z.literal("ncr"),
    lockVersion: z.number().int().nonnegative(),
    existingNcrId: z.string().uuid(),
  })
  .strict();

const ComplaintConvertToEightD = z
  .object({
    target: z.literal("eight_d"),
    lockVersion: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(300).optional(),
  })
  .strict();

/** CAPA's `type` has no complaint analog, so the caller must supply it — the
 *  one field this variant requires beyond what severity can derive (§0
 *  B6g). */
const ComplaintConvertToCapa = z
  .object({
    target: z.literal("capa"),
    lockVersion: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(300).optional(),
    type: CapaType,
  })
  .strict();

export const ComplaintConvertBody = z.union([
  ComplaintConvertToNcrCreate,
  ComplaintConvertToExistingNcr,
  ComplaintConvertToEightD,
  ComplaintConvertToCapa,
]);
export type ComplaintConvertBody = z.infer<typeof ComplaintConvertBody>;

/** `POST /v1/complaints/:id/convert`'s response — the updated complaint plus
 *  a small pointer to whichever record was created or linked (§2 C4 AC1/2).
 *  Never the full NCR/8D/CAPA DTO: the caller re-fetches that module's own
 *  detail route if it needs the rest, mirroring how `raiseNcr`/`raiseCapa`
 *  return only the source record today. */
export const ComplaintConvertResult = z.object({
  complaint: ComplaintDto,
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("ncr"), id: z.string().uuid(), code: z.string() }),
    z.object({ kind: z.literal("eight_d"), id: z.string().uuid(), code: z.string() }),
    z.object({ kind: z.literal("capa"), id: z.string().uuid(), code: z.string() }),
  ]),
});
export type ComplaintConvertResult = z.infer<typeof ComplaintConvertResult>;

/** `GET /v1/complaints/summary` (§2 C1 AC3) — one round trip for the KPI
 *  strip + the 4 filter tabs' own counts; a cursor-paginated list cannot
 *  compute a tenant-wide total client-side (rule 6). `responseWithin24hPct`/
 *  `avgTimeToCloseDays`/`avgCostPerComplaint` are `null` (never `NaN`/`0`)
 *  when their denominator is zero. */
export const ComplaintSummaryDto = z.object({
  open: z.number().int().nonnegative(),
  critical: z.number().int().nonnegative(),
  responseWithin24hPct: z.number().min(0).max(100).nullable(),
  avgTimeToCloseDays: z.number().nonnegative().nullable(),
  avgCostPerComplaint: z.number().nonnegative().nullable(),
  tabCounts: z.object({
    all: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
    noLink: z.number().int().nonnegative(),
    mine: z.number().int().nonnegative(),
  }),
});
export type ComplaintSummaryDto = z.infer<typeof ComplaintSummaryDto>;

// --- Engineering Change Notices (Sprint 06 E1-E5, P19) ----------------------

/** Persisted E5 auto-revise outcome (`ecns.auto_revise_result`, §0 B3e) —
 *  readable after the fact via `EcnDto.autoReviseResult`, not only returned
 *  once in the approval response. */
export const AutoReviseResult = z.object({
  revised: z.array(z.string().uuid()),
  skipped: z.array(
    z.object({
      documentId: z.string().uuid(),
      reason: EcnAutoReviseSkipReason,
    }),
  ),
});
export type AutoReviseResult = z.infer<typeof AutoReviseResult>;

export const EcnDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  changeType: EcnChangeType,
  description: z.string(),
  changeRisk: EcnChangeRisk,
  stage: EcnStage,
  owner: z.string().uuid(),
  effectiveDate: DateOnly.nullable(),
  /** Computed on read — `count(*)` over `entity_links WHERE from_kind='ecn'
   *  AND to_kind='document' AND from_id=:id` (§0 B8a), never a column. */
  linkedDocumentCount: z.number().int().nonnegative(),
  autoReviseResult: AutoReviseResult.nullable(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EcnDto = z.infer<typeof EcnDto>;

export const EcnListQuery = PageQuery.extend({
  changeType: EcnChangeType.optional(),
  stage: EcnStage.optional(),
  changeRisk: EcnChangeRisk.optional(),
  owner: z.string().uuid().optional(),
  /** Free-text search over title/description (E1 AC3). */
  q: z.string().trim().min(1).max(200).optional(),
});
export type EcnListQuery = z.infer<typeof EcnListQuery>;

/** `POST /v1/ecns` (§2 E1 AC3, E3 AC1) — always created at `stage: 'draft'`;
 *  the 5 `ecn_approvals` rows are pre-created server-side in the same
 *  transaction (E4 AC1), never client-supplied. */
export const CreateEcnBody = z.object({
  changeType: EcnChangeType,
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).optional(),
  changeRisk: EcnChangeRisk,
  effectiveDate: DateOnly.nullable().optional(),
  owner: z.string().uuid(),
});
export type CreateEcnBody = z.infer<typeof CreateEcnBody>;

/**
 * `PATCH /v1/ecns/:id` (§2 E1 AC3, revised §0 B2/S4). `title`/`description`/
 * `effectiveDate` are always editable; `changeType`/`changeRisk`/`owner` only
 * while `stage = 'draft'` (incl. a `draft` reached again via resubmission,
 * §0b D3) — 422 otherwise. Rejected entirely (422) once `stage` is `closed`
 * or `rejected`. Never accepts `stage` directly — that changes only via the
 * submit/withdraw/approve-reject/close/resubmit routes.
 */
export const UpdateEcnBody = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(10_000).optional(),
  effectiveDate: DateOnly.nullable().optional(),
  changeType: EcnChangeType.optional(),
  changeRisk: EcnChangeRisk.optional(),
  owner: z.string().uuid().optional(),
  lockVersion: z.number().int().nonnegative(),
});
export type UpdateEcnBody = z.infer<typeof UpdateEcnBody>;

/** Shared shape for the four plain lifecycle actions — submit, withdraw,
 *  close, resubmit (§0 B1/§0b D3) — each is `lockVersion`-guarded and nothing
 *  else. */
export const EcnLifecycleBody = z.object({ lockVersion: z.number().int().nonnegative() }).strict();
export type EcnLifecycleBody = z.infer<typeof EcnLifecycleBody>;

/** `GET /v1/ecns/summary` (§2 E2 AC2) — `count(*) group by stage`, all 9
 *  stage keys always present (0 for an empty one, incl. `ppap`). */
export const EcnSummaryDto = z.object({
  draft: z.number().int().nonnegative(),
  feasibility: z.number().int().nonnegative(),
  risk_review: z.number().int().nonnegative(),
  ppap: z.number().int().nonnegative(),
  cab_approval: z.number().int().nonnegative(),
  pilot: z.number().int().nonnegative(),
  implementation: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
});
export type EcnSummaryDto = z.infer<typeof EcnSummaryDto>;

export const EcnApprovalDto = z.object({
  id: z.string().uuid(),
  ecnId: z.string().uuid(),
  stage: EcnApprovalStage,
  decision: EcnApprovalDecision,
  approver: z.string().uuid().nullable(),
  decidedAt: z.string().datetime().nullable(),
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EcnApprovalDto = z.infer<typeof EcnApprovalDto>;

/** `POST /v1/ecns/:id/approvals/:stage` (§2 E4 AC2) — a rejection must carry
 *  a reason; `comment` is therefore required when `decision: "reject"`. */
export const DecideEcnApprovalBody = z
  .object({
    decision: z.enum(["approve", "reject"]),
    comment: z.string().trim().min(1).max(2000).optional(),
    lockVersion: z.number().int().nonnegative(),
  })
  .refine((body) => body.decision !== "reject" || (body.comment?.length ?? 0) > 0, {
    message: "A rejection must carry a comment",
    path: ["comment"],
  });
export type DecideEcnApprovalBody = z.infer<typeof DecideEcnApprovalBody>;

/** `POST /v1/ecns/:id/link` (§2 E5 AC1) — `document`/`supplier` only, never
 *  `part` (no `parts` table/`EntityKind` exists anywhere in this codebase,
 *  §1a/§3.2). */
export const EcnLinkBody = z.object({
  kind: z.enum(["document", "supplier"]),
  targetId: z.string().uuid(),
});
export type EcnLinkBody = z.infer<typeof EcnLinkBody>;

export const EcnLinkDto = z.object({
  id: z.string().uuid(),
  kind: z.enum(["document", "supplier"]),
  targetId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type EcnLinkDto = z.infer<typeof EcnLinkDto>;
