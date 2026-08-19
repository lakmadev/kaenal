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
  PpapElementStatus,
  PpapStatus,
  ChargebackStatus,
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
  /** Who raised the NCR (=created_by) — the detail's "Reporter" row. */
  reporterId: z.string().uuid().nullable(),
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
  /** Who caused this notification (an assigner), for the row avatar. NULL for
   *  system/job notifications with no actor (document_expiring, export_ready…). */
  actorId: z.string().uuid().nullable(),
  /** The user flagged this to find it later (the star toggle). */
  starred: z.boolean(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type NotificationDto = z.infer<typeof NotificationDto>;

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
