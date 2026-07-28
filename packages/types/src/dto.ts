import { z } from "zod";
import {
  AiConfidence,
  AiFeature,
  AuditAction,
  AuditFindingKind,
  AuditPhase,
  AuditType,
  CapaActionStatus,
  CapaPhase,
  CapaType,
  DocumentCategory,
  DocumentStatus,
  EightDStatus,
  EntityKind,
  EightDStepStatus,
  ExportFormat,
  ExportResource,
  ExportStatus,
  FindingSeverity,
  InspectionStatus,
  NcrActionKind,
  NcrActionStatus,
  NcrPriority,
  NcrSource,
  NcrStatus,
  RecurrenceFreq,
  RiskLevel,
  ScanStatus,
  SlaState,
  TemplateStatus,
} from "./enums.js";
import { FormResponses, FormSchema } from "./form.js";

/**
 * Wire representations (03 §1). camelCase, the API's public shape — distinct
 * from the snake_case database rows. A service maps a row onto one of these; a
 * column rename never leaks to the client because the mapping is explicit.
 */

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
});
export type CreateInspectionBody = z.infer<typeof CreateInspectionBody>;

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
  status: NcrStatus,
  ownerId: z.string().uuid().nullable(),
  plantId: z.string().uuid().nullable(),
  areaId: z.string().uuid().nullable(),
  dueAt: z.string().datetime().nullable(),
  slaState: SlaState,
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
  source: NcrSource.optional(),
  sourceId: z.string().uuid().nullable().optional(),
  /** Raising an NCR from a finding links the finding and defaults the source. */
  findingId: z.string().uuid().optional(),
  plantId: z.string().uuid().nullable().optional(),
  areaId: z.string().uuid().nullable().optional(),
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

export const DownloadFileResult = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
  /** True when the file is not yet scanned clean — the client should watermark it. */
  scanPending: z.boolean(),
});
export type DownloadFileResult = z.infer<typeof DownloadFileResult>;

// --- Search -----------------------------------------------------------------

/** The entity kinds the command palette federates over (03 §1, 04). */
export const SearchEntityKind = z.enum(["inspection", "ncr", "capa", "document"]);
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
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type NotificationDto = z.infer<typeof NotificationDto>;

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

// --- Audits ------------------------------------------------------------------

export const AuditDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  standard: z.string().nullable(),
  type: AuditType,
  status: AuditPhase,
  leadAuditorId: z.string().uuid().nullable(),
  team: z.array(z.string().uuid()),
  plantId: z.string().uuid().nullable(),
  startAt: z.string().datetime().nullable(),
  endAt: z.string().datetime().nullable(),
  progress: z.number(),
  lockVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AuditDto = z.infer<typeof AuditDto>;

export const CreateAuditBody = z.object({
  title: z.string().min(1).max(200),
  type: AuditType,
  standard: z.string().max(200).nullable().optional(),
  leadAuditorId: z.string().uuid().nullable().optional(),
  team: z.array(z.string().uuid()).max(50).optional(),
  plantId: z.string().uuid().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
});
export type CreateAuditBody = z.infer<typeof CreateAuditBody>;

/** Advance an audit one phase forward (planned → … → closed). */
export const AdvanceAuditBody = z.object({
  to: AuditPhase,
  version: z.number().int().nonnegative(),
  reason: z.string().max(2000).optional(),
});
export type AdvanceAuditBody = z.infer<typeof AdvanceAuditBody>;

export const AuditFindingDto = z.object({
  id: z.string().uuid(),
  auditId: z.string().uuid(),
  clause: z.string().nullable(),
  kind: AuditFindingKind,
  description: z.string(),
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

/** Optional filters narrowing the exported set; applied by the renderer. */
export const ExportFilters = z.object({
  status: z.string().max(60).optional(),
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

export const CreateExportBody = z.object({
  resource: ExportResource,
  /** Only `csv` is built today; the enum is where new renderers slot in. */
  format: ExportFormat.default("csv"),
  filters: ExportFilters.optional(),
});
export type CreateExportBody = z.infer<typeof CreateExportBody>;

// --- Me (session identity) --------------------------------------------------

export const MeDto = z.object({
  userId: z.string().uuid(),
  tenantSlug: z.string(),
  role: z.string(),
  capabilities: z.array(z.string()),
});
export type MeDto = z.infer<typeof MeDto>;

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
 * One row of an entity's access log — a projection of `audit_events` that
 * deliberately omits `before`/`after` (which can carry changed field values) so
 * the log reveals who did what and when without leaking payloads (07 §1).
 */
export const AuditEventDto = z.object({
  id: z.string().uuid(),
  entityKind: z.string(),
  entityId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  actorKind: z.string(),
  action: AuditAction,
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditEventDto = z.infer<typeof AuditEventDto>;

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
