import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  AdvanceAuditBody,
  AdvanceCapaBody,
  AuditDto,
  AuditFindingDto,
  CapaActionDto,
  CapaDto,
  CreateAuditBody,
  CreateAuditFindingBody,
  CompleteFileBody,
  CompleteInspectionBody,
  CreateCapaActionBody,
  CreateCapaBody,
  CreateDocumentBody,
  CreateFindingBody,
  CreateInspectionBody,
  CreateNcrActionBody,
  CreateNcrBody,
  CreateTemplateBody,
  CreateEightDBody,
  CreateExportBody,
  DocumentDto,
  DocumentVersionDto,
  DownloadFileResult,
  EightDDto,
  ExportDto,
  FileDto,
  FindingDto,
  InspectionDto,
  MeDto,
  NcrActionDto,
  NcrDto,
  CountDto,
  NewDocumentVersionBody,
  NotificationDto,
  NotificationPrefsDto,
  PresignFileBody,
  PresignFileResult,
  RaiseCapaFromFindingBody,
  RaiseNcrFromFindingBody,
  ReviewDocumentBody,
  SearchResults,
  UnreadCountDto,
  UpdateEightDStepBody,
  UpdateNotificationPrefsBody,
  RevertCapaBody,
  StartInspectionBody,
  TemplateDto,
  TransitionDocumentBody,
  TransitionEightDBody,
  TransitionNcrBody,
  UpdateCapaActionStatusBody,
  UpdateNcrActionStatusBody,
  VerifyNcrBody,
} from "./dto.js";
import { ErrorBody, PageQuery, page } from "./http.js";
import {
  AuditPhase,
  AuditType,
  CapaPhase,
  CapaType,
  DocumentCategory,
  DocumentStatus,
  EightDStatus,
  ExportResource,
  ExportStatus,
  InspectionStatus,
  NcrPriority,
  NcrStatus,
  TemplateStatus,
} from "./enums.js";

/**
 * The API contract (03 §1) — contract-first, in `packages/types` so it is the
 * one artifact the server, the OpenAPI document, and the typed client all
 * derive from. The Nest handlers validate their inputs against these very
 * schemas; the web client is `initClient(contract)`. Neither side can drift
 * from the other because there is only one definition.
 */

const c = initContract();

/** Errors any authenticated route may return. Declared once, spread per route. */
const commonErrors = {
  400: ErrorBody,
  401: ErrorBody,
  403: ErrorBody,
  404: ErrorBody,
  409: ErrorBody,
  422: ErrorBody,
  429: ErrorBody,
} as const;

export const contract = c.router(
  {
    getMe: {
      method: "GET",
      path: "/v1/me",
      responses: { 200: MeDto, 401: ErrorBody },
      summary: "The current session's identity and capabilities",
    },

    // --- Search ------------------------------------------------------------
    search: {
      method: "GET",
      path: "/v1/search",
      query: z.object({ q: z.string().min(1).max(200) }),
      responses: { 200: SearchResults, ...commonErrors },
      summary: "Federated full-text search across records (top 6 per kind), plant-scoped by role",
    },

    // --- Inspection templates ---------------------------------------------
    listTemplates: {
      method: "GET",
      path: "/v1/inspection-templates",
      query: PageQuery.extend({ status: TemplateStatus.optional() }),
      responses: { 200: page(TemplateDto), ...commonErrors },
      summary: "List inspection templates (cursor-paginated)",
    },
    createTemplate: {
      method: "POST",
      path: "/v1/inspection-templates",
      body: CreateTemplateBody,
      responses: { 201: TemplateDto, ...commonErrors },
      summary: "Create a draft template",
    },
    getTemplate: {
      method: "GET",
      path: "/v1/inspection-templates/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: TemplateDto, ...commonErrors },
      summary: "Fetch one template (with its form schema)",
    },
    publishTemplate: {
      method: "POST",
      path: "/v1/inspection-templates/:id/publish",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ version: z.number().int().nonnegative() }),
      responses: { 200: TemplateDto, ...commonErrors },
      summary: "Publish a draft template (makes its schema immutable)",
    },

    // --- Inspections -------------------------------------------------------
    listInspections: {
      method: "GET",
      path: "/v1/inspections",
      query: PageQuery.extend({
        status: InspectionStatus.optional(),
        plantId: z.string().uuid().optional(),
      }),
      responses: { 200: page(InspectionDto), ...commonErrors },
      summary: "List inspections (cursor-paginated, plant-scoped by role)",
    },
    createInspection: {
      method: "POST",
      path: "/v1/inspections",
      body: CreateInspectionBody,
      responses: { 201: InspectionDto, ...commonErrors },
      summary: "Schedule an inspection from a published template",
    },
    getInspection: {
      method: "GET",
      path: "/v1/inspections/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: InspectionDto, ...commonErrors },
      summary: "Fetch one inspection",
    },
    startInspection: {
      method: "POST",
      path: "/v1/inspections/:id/start",
      pathParams: z.object({ id: z.string().uuid() }),
      body: StartInspectionBody,
      responses: { 200: InspectionDto, ...commonErrors },
      summary: "Begin an inspection (scheduled → in_progress)",
    },
    completeInspection: {
      method: "POST",
      path: "/v1/inspections/:id/complete",
      pathParams: z.object({ id: z.string().uuid() }),
      body: CompleteInspectionBody,
      responses: { 200: InspectionDto, ...commonErrors },
      summary: "Submit responses, validate + score, and complete an inspection",
    },

    // --- Findings ----------------------------------------------------------
    listFindings: {
      method: "GET",
      path: "/v1/inspections/:id/findings",
      pathParams: z.object({ id: z.string().uuid() }),
      query: PageQuery,
      responses: { 200: page(FindingDto), ...commonErrors },
      summary: "List an inspection's findings",
    },
    createFinding: {
      method: "POST",
      path: "/v1/inspections/:id/findings",
      pathParams: z.object({ id: z.string().uuid() }),
      body: CreateFindingBody,
      responses: { 201: FindingDto, ...commonErrors },
      summary: "Record a finding against an inspection",
    },

    // --- NCRs --------------------------------------------------------------
    listNcrs: {
      method: "GET",
      path: "/v1/ncrs",
      query: PageQuery.extend({
        status: NcrStatus.optional(),
        priority: NcrPriority.optional(),
        plantId: z.string().uuid().optional(),
      }),
      responses: { 200: page(NcrDto), ...commonErrors },
      summary: "List NCRs (cursor-paginated, plant-scoped by role)",
    },
    createNcr: {
      method: "POST",
      path: "/v1/ncrs",
      body: CreateNcrBody,
      responses: { 201: NcrDto, ...commonErrors },
      summary: "Raise an NCR (optionally from a finding)",
    },
    getNcr: {
      method: "GET",
      path: "/v1/ncrs/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: NcrDto, ...commonErrors },
      summary: "Fetch one NCR",
    },
    transitionNcr: {
      method: "POST",
      path: "/v1/ncrs/:id/transition",
      pathParams: z.object({ id: z.string().uuid() }),
      body: TransitionNcrBody,
      responses: { 200: NcrDto, ...commonErrors },
      summary: "Advance an NCR through its lifecycle (assign, start, resolve, close, escalate, reopen)",
    },
    verifyNcr: {
      method: "POST",
      path: "/v1/ncrs/:id/verify",
      pathParams: z.object({ id: z.string().uuid() }),
      body: VerifyNcrBody,
      responses: { 200: NcrDto, ...commonErrors },
      summary: "Verify a resolved NCR (four-eyes: not the resolver)",
    },

    // --- NCR corrective actions -------------------------------------------
    listNcrActions: {
      method: "GET",
      path: "/v1/ncrs/:id/actions",
      pathParams: z.object({ id: z.string().uuid() }),
      query: PageQuery,
      responses: { 200: page(NcrActionDto), ...commonErrors },
      summary: "List an NCR's corrective/preventive actions",
    },
    createNcrAction: {
      method: "POST",
      path: "/v1/ncrs/:id/actions",
      pathParams: z.object({ id: z.string().uuid() }),
      body: CreateNcrActionBody,
      responses: { 201: NcrActionDto, ...commonErrors },
      summary: "Add a corrective/preventive/containment action to an NCR",
    },
    updateNcrActionStatus: {
      method: "POST",
      path: "/v1/ncr-actions/:id/status",
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateNcrActionStatusBody,
      responses: { 200: NcrActionDto, ...commonErrors },
      summary: "Advance an action's status (pending → in_progress → done → verified)",
    },

    // --- 8D ----------------------------------------------------------------
    listEightDs: {
      method: "GET",
      path: "/v1/eight-ds",
      query: PageQuery.extend({
        status: EightDStatus.optional(),
        ncrId: z.string().uuid().optional(),
      }),
      responses: { 200: page(EightDDto), ...commonErrors },
      summary: "List 8D reports (cursor-paginated)",
    },
    createEightD: {
      method: "POST",
      path: "/v1/eight-ds",
      body: CreateEightDBody,
      responses: { 201: EightDDto, ...commonErrors },
      summary: "Open an 8D (optionally from an NCR, which it then blocks from closing)",
    },
    getEightD: {
      method: "GET",
      path: "/v1/eight-ds/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: EightDDto, ...commonErrors },
      summary: "Fetch one 8D with its disciplines",
    },
    updateEightDStep: {
      method: "POST",
      path: "/v1/eight-ds/:id/steps/:step",
      pathParams: z.object({ id: z.string().uuid(), step: z.coerce.number().int().min(1).max(8) }),
      body: UpdateEightDStepBody,
      responses: { 200: EightDDto, ...commonErrors },
      summary: "Update a discipline (D1–D8); completing one is gated by its prerequisites",
    },
    transitionEightD: {
      method: "POST",
      path: "/v1/eight-ds/:id/transition",
      pathParams: z.object({ id: z.string().uuid() }),
      body: TransitionEightDBody,
      responses: { 200: EightDDto, ...commonErrors },
      summary: "Complete (all disciplines done) or cancel an 8D",
    },

    // --- Audits ------------------------------------------------------------
    listAudits: {
      method: "GET",
      path: "/v1/audits",
      query: PageQuery.extend({
        status: AuditPhase.optional(),
        type: AuditType.optional(),
        plantId: z.string().uuid().optional(),
      }),
      responses: { 200: page(AuditDto), ...commonErrors },
      summary: "List audits (cursor-paginated, plant-scoped by role)",
    },
    createAudit: {
      method: "POST",
      path: "/v1/audits",
      body: CreateAuditBody,
      responses: { 201: AuditDto, ...commonErrors },
      summary: "Schedule an audit",
    },
    getAudit: {
      method: "GET",
      path: "/v1/audits/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: AuditDto, ...commonErrors },
      summary: "Fetch one audit",
    },
    advanceAudit: {
      method: "POST",
      path: "/v1/audits/:id/advance",
      pathParams: z.object({ id: z.string().uuid() }),
      body: AdvanceAuditBody,
      responses: { 200: AuditDto, ...commonErrors },
      summary: "Advance an audit one phase forward",
    },
    listAuditFindings: {
      method: "GET",
      path: "/v1/audits/:id/findings",
      pathParams: z.object({ id: z.string().uuid() }),
      query: PageQuery,
      responses: { 200: page(AuditFindingDto), ...commonErrors },
      summary: "List an audit's findings",
    },
    createAuditFinding: {
      method: "POST",
      path: "/v1/audits/:id/findings",
      pathParams: z.object({ id: z.string().uuid() }),
      body: CreateAuditFindingBody,
      responses: { 201: AuditFindingDto, ...commonErrors },
      summary: "Record a finding against an audit",
    },
    raiseNcrFromAuditFinding: {
      method: "POST",
      path: "/v1/audit-findings/:id/raise-ncr",
      pathParams: z.object({ id: z.string().uuid() }),
      body: RaiseNcrFromFindingBody,
      responses: { 201: NcrDto, ...commonErrors },
      summary: "Raise an NCR from an audit finding (links the finding)",
    },
    raiseCapaFromAuditFinding: {
      method: "POST",
      path: "/v1/audit-findings/:id/raise-capa",
      pathParams: z.object({ id: z.string().uuid() }),
      body: RaiseCapaFromFindingBody,
      responses: { 201: CapaDto, ...commonErrors },
      summary: "Raise a CAPA from an audit finding (links the finding)",
    },

    // --- Exports -----------------------------------------------------------
    listExports: {
      method: "GET",
      path: "/v1/exports",
      query: PageQuery.extend({
        resource: ExportResource.optional(),
        status: ExportStatus.optional(),
      }),
      responses: { 200: page(ExportDto), ...commonErrors },
      summary: "List exports (cursor-paginated, newest first)",
    },
    createExport: {
      method: "POST",
      path: "/v1/exports",
      body: CreateExportBody,
      // 202: the render runs on the `reports` queue; poll getExport for the URL.
      responses: { 202: ExportDto, ...commonErrors },
      summary: "Request an async export (returns 202; poll for the download URL)",
    },
    getExport: {
      method: "GET",
      path: "/v1/exports/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: ExportDto, ...commonErrors },
      summary: "Fetch an export's status (with a presigned URL once completed)",
    },

    // --- CAPAs -------------------------------------------------------------
    listCapas: {
      method: "GET",
      path: "/v1/capas",
      query: PageQuery.extend({
        status: CapaPhase.optional(),
        type: CapaType.optional(),
        priority: NcrPriority.optional(),
      }),
      responses: { 200: page(CapaDto), ...commonErrors },
      summary: "List CAPAs (cursor-paginated)",
    },
    createCapa: {
      method: "POST",
      path: "/v1/capas",
      body: CreateCapaBody,
      responses: { 201: CapaDto, ...commonErrors },
      summary: "Open a CAPA",
    },
    getCapa: {
      method: "GET",
      path: "/v1/capas/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: CapaDto, ...commonErrors },
      summary: "Fetch one CAPA",
    },
    advanceCapa: {
      method: "POST",
      path: "/v1/capas/:id/advance",
      pathParams: z.object({ id: z.string().uuid() }),
      body: AdvanceCapaBody,
      responses: { 200: CapaDto, ...commonErrors },
      summary: "Advance a CAPA one phase forward",
    },
    revertCapa: {
      method: "POST",
      path: "/v1/capas/:id/revert",
      pathParams: z.object({ id: z.string().uuid() }),
      body: RevertCapaBody,
      responses: { 200: CapaDto, ...commonErrors },
      summary: "Revert a CAPA to an earlier phase (audited, reason required)",
    },

    // --- CAPA actions ------------------------------------------------------
    listCapaActions: {
      method: "GET",
      path: "/v1/capas/:id/actions",
      pathParams: z.object({ id: z.string().uuid() }),
      query: PageQuery,
      responses: { 200: page(CapaActionDto), ...commonErrors },
      summary: "List a CAPA's actions",
    },
    createCapaAction: {
      method: "POST",
      path: "/v1/capas/:id/actions",
      pathParams: z.object({ id: z.string().uuid() }),
      body: CreateCapaActionBody,
      responses: { 201: CapaActionDto, ...commonErrors },
      summary: "Add an action to a CAPA",
    },
    updateCapaActionStatus: {
      method: "POST",
      path: "/v1/capa-actions/:id/status",
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateCapaActionStatusBody,
      responses: { 200: CapaActionDto, ...commonErrors },
      summary: "Advance a CAPA action's status (pending → in_progress → done → verified)",
    },

    // --- Documents ---------------------------------------------------------
    listDocuments: {
      method: "GET",
      path: "/v1/documents",
      query: PageQuery.extend({
        status: DocumentStatus.optional(),
        category: DocumentCategory.optional(),
      }),
      responses: { 200: page(DocumentDto), ...commonErrors },
      summary: "List documents (cursor-paginated)",
    },
    createDocument: {
      method: "POST",
      path: "/v1/documents",
      body: CreateDocumentBody,
      responses: { 201: DocumentDto, ...commonErrors },
      summary: "Create a document (draft, version 1.0)",
    },
    getDocument: {
      method: "GET",
      path: "/v1/documents/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: DocumentDto, ...commonErrors },
      summary: "Fetch one document",
    },
    transitionDocument: {
      method: "POST",
      path: "/v1/documents/:id/transition",
      pathParams: z.object({ id: z.string().uuid() }),
      body: TransitionDocumentBody,
      responses: { 200: DocumentDto, ...commonErrors },
      summary: "Author-side lifecycle: submit (→pending), revise (rejected→draft), archive",
    },
    reviewDocument: {
      method: "POST",
      path: "/v1/documents/:id/review",
      pathParams: z.object({ id: z.string().uuid() }),
      body: ReviewDocumentBody,
      responses: { 200: DocumentDto, ...commonErrors },
      summary: "Approve or reject a pending document (four-eyes: not the author)",
    },
    listDocumentVersions: {
      method: "GET",
      path: "/v1/documents/:id/versions",
      pathParams: z.object({ id: z.string().uuid() }),
      query: PageQuery,
      responses: { 200: page(DocumentVersionDto), ...commonErrors },
      summary: "List a document's version history",
    },
    newDocumentVersion: {
      method: "POST",
      path: "/v1/documents/:id/versions",
      pathParams: z.object({ id: z.string().uuid() }),
      body: NewDocumentVersionBody,
      responses: { 201: DocumentDto, ...commonErrors },
      summary: "Open a new draft version of an approved document",
    },

    // --- Notifications -----------------------------------------------------
    listNotifications: {
      method: "GET",
      path: "/v1/notifications",
      query: PageQuery.extend({ unread: z.coerce.boolean().optional() }),
      responses: { 200: page(NotificationDto), ...commonErrors },
      summary: "List the current user's notifications (cursor-paginated; unread filter)",
    },
    unreadCount: {
      method: "GET",
      path: "/v1/notifications/unread-count",
      responses: { 200: UnreadCountDto, ...commonErrors },
      summary: "The current user's unread notification count (the bell badge)",
    },
    markNotificationRead: {
      method: "POST",
      path: "/v1/notifications/:id/read",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: NotificationDto, ...commonErrors },
      summary: "Mark one of the current user's notifications read",
    },
    markAllNotificationsRead: {
      method: "POST",
      path: "/v1/notifications/read-all",
      body: z.object({}),
      responses: { 200: CountDto, ...commonErrors },
      summary: "Mark all of the current user's notifications read",
    },
    getNotificationPrefs: {
      method: "GET",
      path: "/v1/notification-prefs",
      responses: { 200: NotificationPrefsDto, ...commonErrors },
      summary: "The current user's per-kind channel preferences",
    },
    updateNotificationPrefs: {
      method: "PUT",
      path: "/v1/notification-prefs",
      body: UpdateNotificationPrefsBody,
      responses: { 200: NotificationPrefsDto, ...commonErrors },
      summary: "Replace the current user's notification channel matrix",
    },

    // --- Files -------------------------------------------------------------
    presignFile: {
      method: "POST",
      path: "/v1/files/presign",
      body: PresignFileBody,
      responses: { 201: PresignFileResult, ...commonErrors },
      summary: "Validate mime + size and get a presigned upload URL (file row: pending)",
    },
    completeFile: {
      method: "POST",
      path: "/v1/files/:id/complete",
      pathParams: z.object({ id: z.string().uuid() }),
      body: CompleteFileBody,
      responses: { 200: FileDto, ...commonErrors },
      summary: "Confirm the upload finished; server verifies the object and records its hash",
    },
    getFile: {
      method: "GET",
      path: "/v1/files/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: FileDto, ...commonErrors },
      summary: "Fetch a file's metadata",
    },
    downloadFile: {
      method: "GET",
      path: "/v1/files/:id/download",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: DownloadFileResult, ...commonErrors },
      summary: "Get a presigned download URL (gated on AV scan status; audited)",
    },
  },
  {
    strictStatusCodes: true,
  },
);

export type Contract = typeof contract;
