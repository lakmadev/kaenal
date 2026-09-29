import type {
  AuditEventDto,
  BrandingDto,
  SessionPolicyDto,
  NcrValidationRuleDto,
  LegalHoldDto,
  DlpPolicyDto,
  CostCenterDto,
  CostCenterAssignmentDto,
  ChargebackSettingsDto,
  ChargebackReportDto,
  FmeaDto,
  FmeaItemDto,
  MsaStudyDto,
  MsaAnalysisResult,
  IntegrationDto,
  IntegrationEventDto,
  WebhookPolicyDto,
  ConnectorSchemaResult,
  ImportTargetsResult,
  ImportProfileDto,
  ImportRunDto,
  SpcCharacteristicsResult,
  SpcChartDto,
  ReportDefinitionDto,
  Query,
  QuerySourcesResult,
  QueryRowsResult,
  QueryMetricResult,
  QuerySeriesResult,
  AuditDto,
  AuditFindingDto,
  AuditFrequencyResult,
  AuditStatsDto,
  CapaDto,
  CommentDto,
  DocumentDto,
  DocumentVersionDto,
  EntityKind,
  EntityLinkDto,
  FileDto,
  InspectionDto,
  MeDto,
  MemberDto,
  NcrActionDto,
  NcrDto,
  NotificationPageDto,
  NotificationPrefsDto,
  Page,
  PpapSubmissionDto,
  ScarDto,
  PortalIdentityDto,
  PortalScarDto,
  PortalPpapDto,
  EightDDto,
  GraphExpandResult,
  GraphQueryId,
  GraphQueryResult,
  GraphSeedsResult,
  SearchResults,
  SupplierDto,
  UnreadCountDto,
  WorkspacesDto,
  RiskPredictionDto,
  PredictionDetailResponse,
  RiskDto,
  RiskSummaryDto,
  InstrumentDto,
  InstrumentSummaryDto,
  CalibrationEventDto,
  CompetencyDto,
  TrainingMatrixRowDto,
  TrainingSummaryDto,
  TrainingGapDto,
  TrainingRecordDto,
} from "@kaenal/types";
import type { ApiClient } from "./client.js";
import { queryKeys } from "./query-keys.js";

/**
 * TanStack Query integration, framework-agnostic. Rather than bake React or a
 * specific @tanstack/react-query major into this shared client (it ships to both
 * Next and Expo), each factory returns a plain query-option object
 * `{ queryKey, queryFn }` — the pattern TanStack v5 itself recommends. The app
 * feeds it straight to `useQuery`:
 *
 *   const q = useQuery(apiQueries.ncrs.list(client, { query: { status: "open" } }));
 *
 * Mutations are the client call composed with `unwrap`:
 *
 *   useMutation({ mutationFn: (body) => unwrap(client.createNcr({ body })) });
 */

export interface QueryOption<TData> {
  readonly queryKey: readonly unknown[];
  readonly queryFn: () => Promise<TData>;
}

/** Raised by `unwrap` when the API returns a non-2xx status (the error envelope). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiRequestError";
  }
}

/**
 * Turn a ts-rest response (a discriminated union on `status`) into a value or a
 * throw — which is what TanStack Query's `queryFn`/`mutationFn` expect (a
 * rejected promise becomes an error state). Success bodies pass through typed.
 */
export function unwrap<TData>(res: { status: number; body: unknown }): Promise<TData> {
  if (res.status >= 200 && res.status < 300) return Promise.resolve(res.body as TData);
  return Promise.reject(new ApiRequestError(res.status, res.body));
}

// Argument types forwarded verbatim to the client methods, so the factories stay
// as strongly typed as the contract without re-declaring each shape.
type Arg<K extends keyof ApiClient> = ApiClient[K] extends (args: infer A) => unknown ? A : never;

export const apiQueries = {
  me: (client: ApiClient): QueryOption<MeDto> => ({
    queryKey: queryKeys.me(),
    queryFn: () => client.getMe().then((r) => unwrap<MeDto>(r)),
  }),

  workspaces: (client: ApiClient): QueryOption<WorkspacesDto> => ({
    queryKey: queryKeys.workspaces(),
    queryFn: () => client.myWorkspaces().then((r) => unwrap<WorkspacesDto>(r)),
  }),

  members: {
    list: (client: ApiClient, args?: Arg<"listMembers">): QueryOption<Page<MemberDto>> => ({
      queryKey: queryKeys.members.list(args?.query),
      queryFn: () => client.listMembers(args).then((r) => unwrap<Page<MemberDto>>(r)),
    }),
  },

  search: (client: ApiClient, q: string): QueryOption<SearchResults> => ({
    queryKey: queryKeys.search(q),
    queryFn: () => client.search({ query: { q } }).then((r) => unwrap<SearchResults>(r)),
  }),

  inspections: {
    list: (client: ApiClient, args?: Arg<"listInspections">): QueryOption<Page<InspectionDto>> => ({
      queryKey: queryKeys.inspections.list(args?.query),
      queryFn: () => client.listInspections(args).then((r) => unwrap<Page<InspectionDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<InspectionDto> => ({
      queryKey: queryKeys.inspections.detail(id),
      queryFn: () => client.getInspection({ params: { id } }).then((r) => unwrap<InspectionDto>(r)),
    }),
  },

  ncrs: {
    list: (client: ApiClient, args?: Arg<"listNcrs">): QueryOption<Page<NcrDto>> => ({
      queryKey: queryKeys.ncrs.list(args?.query),
      queryFn: () => client.listNcrs(args).then((r) => unwrap<Page<NcrDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<NcrDto> => ({
      queryKey: queryKeys.ncrs.detail(id),
      queryFn: () => client.getNcr({ params: { id } }).then((r) => unwrap<NcrDto>(r)),
    }),
    actions: (client: ApiClient, id: string): QueryOption<Page<NcrActionDto>> => ({
      queryKey: queryKeys.ncrs.actions(id),
      queryFn: () => client.listNcrActions({ params: { id } }).then((r) => unwrap<Page<NcrActionDto>>(r)),
    }),
  },

  capas: {
    list: (client: ApiClient, args?: Arg<"listCapas">): QueryOption<Page<CapaDto>> => ({
      queryKey: queryKeys.capas.list(args?.query),
      queryFn: () => client.listCapas(args).then((r) => unwrap<Page<CapaDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<CapaDto> => ({
      queryKey: queryKeys.capas.detail(id),
      queryFn: () => client.getCapa({ params: { id } }).then((r) => unwrap<CapaDto>(r)),
    }),
  },

  audits: {
    list: (client: ApiClient, args?: Arg<"listAudits">): QueryOption<Page<AuditDto>> => ({
      queryKey: queryKeys.audits.list(args?.query),
      queryFn: () => client.listAudits(args).then((r) => unwrap<Page<AuditDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<AuditDto> => ({
      queryKey: queryKeys.audits.detail(id),
      queryFn: () => client.getAudit({ params: { id } }).then((r) => unwrap<AuditDto>(r)),
    }),
    findings: (client: ApiClient, id: string): QueryOption<Page<AuditFindingDto>> => ({
      queryKey: queryKeys.audits.findings(id),
      queryFn: () => client.listAuditFindings({ params: { id } }).then((r) => unwrap<Page<AuditFindingDto>>(r)),
    }),
    frequency: (client: ApiClient): QueryOption<AuditFrequencyResult> => ({
      queryKey: queryKeys.audits.frequency(),
      queryFn: () => client.getAuditFrequency().then((r) => unwrap<AuditFrequencyResult>(r)),
    }),
    stats: (client: ApiClient): QueryOption<AuditStatsDto> => ({
      queryKey: queryKeys.audits.stats(),
      queryFn: () => client.getAuditStats().then((r) => unwrap<AuditStatsDto>(r)),
    }),
  },

  documents: {
    list: (client: ApiClient, args?: Arg<"listDocuments">): QueryOption<Page<DocumentDto>> => ({
      queryKey: queryKeys.documents.list(args?.query),
      queryFn: () => client.listDocuments(args).then((r) => unwrap<Page<DocumentDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<DocumentDto> => ({
      queryKey: queryKeys.documents.detail(id),
      queryFn: () => client.getDocument({ params: { id } }).then((r) => unwrap<DocumentDto>(r)),
    }),
    versions: (client: ApiClient, id: string): QueryOption<Page<DocumentVersionDto>> => ({
      queryKey: queryKeys.documents.versions(id),
      queryFn: () => client.listDocumentVersions({ params: { id } }).then((r) => unwrap<Page<DocumentVersionDto>>(r)),
    }),
  },

  suppliers: {
    list: (client: ApiClient, args?: Arg<"listSuppliers">): QueryOption<Page<SupplierDto>> => ({
      queryKey: queryKeys.suppliers.list(args?.query),
      queryFn: () => client.listSuppliers(args).then((r) => unwrap<Page<SupplierDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<SupplierDto> => ({
      queryKey: queryKeys.suppliers.detail(id),
      queryFn: () => client.getSupplier({ params: { id } }).then((r) => unwrap<SupplierDto>(r)),
    }),
    scorecard: (client: ApiClient, args?: Arg<"scorecardSuppliers">): QueryOption<Page<SupplierDto>> => ({
      queryKey: queryKeys.suppliers.scorecard(args?.query),
      queryFn: () => client.scorecardSuppliers(args).then((r) => unwrap<Page<SupplierDto>>(r)),
    }),
  },

  ppap: {
    list: (client: ApiClient, args?: Arg<"listPpap">): QueryOption<Page<PpapSubmissionDto>> => ({
      queryKey: queryKeys.ppap.list(args?.query),
      queryFn: () => client.listPpap(args).then((r) => unwrap<Page<PpapSubmissionDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<PpapSubmissionDto> => ({
      queryKey: queryKeys.ppap.detail(id),
      queryFn: () => client.getPpap({ params: { id } }).then((r) => unwrap<PpapSubmissionDto>(r)),
    }),
  },

  scars: {
    list: (client: ApiClient, args?: Arg<"listScars">): QueryOption<Page<ScarDto>> => ({
      queryKey: queryKeys.scars.list(args?.query),
      queryFn: () => client.listScars(args).then((r) => unwrap<Page<ScarDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<ScarDto> => ({
      queryKey: queryKeys.scars.detail(id),
      queryFn: () => client.getScar({ params: { id } }).then((r) => unwrap<ScarDto>(r)),
    }),
  },

  eightDs: {
    list: (client: ApiClient, args?: Arg<"listEightDs">): QueryOption<Page<EightDDto>> => ({
      queryKey: queryKeys.eightDs.list(args?.query),
      queryFn: () => client.listEightDs(args).then((r) => unwrap<Page<EightDDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<EightDDto> => ({
      queryKey: queryKeys.eightDs.detail(id),
      queryFn: () => client.getEightD({ params: { id } }).then((r) => unwrap<EightDDto>(r)),
    }),
  },

  portal: {
    identity: (client: ApiClient): QueryOption<PortalIdentityDto> => ({
      queryKey: queryKeys.portal.identity(),
      queryFn: () => client.getPortalIdentity().then((r) => unwrap<PortalIdentityDto>(r)),
    }),
    scars: (client: ApiClient, args?: Arg<"listPortalScars">): QueryOption<Page<PortalScarDto>> => ({
      queryKey: queryKeys.portal.scars(args?.query),
      queryFn: () => client.listPortalScars(args).then((r) => unwrap<Page<PortalScarDto>>(r)),
    }),
    scar: (client: ApiClient, id: string): QueryOption<PortalScarDto> => ({
      queryKey: queryKeys.portal.scar(id),
      queryFn: () => client.getPortalScar({ params: { id } }).then((r) => unwrap<PortalScarDto>(r)),
    }),
    ppapList: (client: ApiClient, args?: Arg<"listPortalPpap">): QueryOption<Page<PortalPpapDto>> => ({
      queryKey: queryKeys.portal.ppapList(args?.query),
      queryFn: () => client.listPortalPpap(args).then((r) => unwrap<Page<PortalPpapDto>>(r)),
    }),
    ppap: (client: ApiClient, id: string): QueryOption<PortalPpapDto> => ({
      queryKey: queryKeys.portal.ppap(id),
      queryFn: () => client.getPortalPpap({ params: { id } }).then((r) => unwrap<PortalPpapDto>(r)),
    }),
  },

  files: {
    detail: (client: ApiClient, id: string): QueryOption<FileDto> => ({
      queryKey: queryKeys.files.detail(id),
      queryFn: () => client.getFile({ params: { id } }).then((r) => unwrap<FileDto>(r)),
    }),
  },

  comments: {
    list: (client: ApiClient, entityKind: EntityKind, entityId: string): QueryOption<Page<CommentDto>> => ({
      queryKey: queryKeys.comments.list(entityKind, entityId),
      queryFn: () =>
        client.listComments({ query: { entityKind, entityId, limit: 100 } }).then((r) => unwrap<Page<CommentDto>>(r)),
    }),
  },

  entityLinks: {
    list: (client: ApiClient, entityKind: EntityKind, entityId: string): QueryOption<Page<EntityLinkDto>> => ({
      queryKey: queryKeys.entityLinks.list(entityKind, entityId),
      queryFn: () =>
        client.listEntityLinks({ query: { entityKind, entityId } }).then((r) => unwrap<Page<EntityLinkDto>>(r)),
    }),
  },

  auditEvents: {
    list: (client: ApiClient, entityKind: EntityKind, entityId: string): QueryOption<Page<AuditEventDto>> => ({
      queryKey: queryKeys.auditEvents.list(entityKind, entityId),
      queryFn: () =>
        client.listAuditEvents({ query: { entityKind, entityId, limit: 50 } }).then((r) => unwrap<Page<AuditEventDto>>(r)),
    }),
  },

  notifications: {
    list: (client: ApiClient, args?: Arg<"listNotifications">): QueryOption<NotificationPageDto> => ({
      queryKey: queryKeys.notifications.list(args?.query),
      queryFn: () => client.listNotifications(args).then((r) => unwrap<NotificationPageDto>(r)),
    }),
    unreadCount: (client: ApiClient): QueryOption<UnreadCountDto> => ({
      queryKey: queryKeys.notifications.unreadCount(),
      queryFn: () => client.unreadCount().then((r) => unwrap<UnreadCountDto>(r)),
    }),
    prefs: (client: ApiClient): QueryOption<NotificationPrefsDto> => ({
      queryKey: queryKeys.notifications.prefs(),
      queryFn: () => client.getNotificationPrefs().then((r) => unwrap<NotificationPrefsDto>(r)),
    }),
  },

  settings: {
    branding: (client: ApiClient): QueryOption<BrandingDto> => ({
      queryKey: queryKeys.settings.branding(),
      queryFn: () => client.getBranding().then((r) => unwrap<BrandingDto>(r)),
    }),
    sessionPolicy: (client: ApiClient): QueryOption<SessionPolicyDto> => ({
      queryKey: queryKeys.settings.sessionPolicy(),
      queryFn: () => client.getSessionPolicy().then((r) => unwrap<SessionPolicyDto>(r)),
    }),
    ncrRules: (client: ApiClient): QueryOption<Page<NcrValidationRuleDto>> => ({
      queryKey: queryKeys.settings.ncrRules(),
      queryFn: () => client.listNcrValidationRules().then((r) => unwrap<Page<NcrValidationRuleDto>>(r)),
    }),
    legalHolds: (client: ApiClient): QueryOption<Page<LegalHoldDto>> => ({
      queryKey: queryKeys.settings.legalHolds(),
      queryFn: () => client.listLegalHolds().then((r) => unwrap<Page<LegalHoldDto>>(r)),
    }),
    dlpPolicies: (client: ApiClient): QueryOption<Page<DlpPolicyDto>> => ({
      queryKey: queryKeys.settings.dlpPolicies(),
      queryFn: () => client.listDlpPolicies().then((r) => unwrap<Page<DlpPolicyDto>>(r)),
    }),
    costCenters: (client: ApiClient): QueryOption<Page<CostCenterDto>> => ({
      queryKey: queryKeys.settings.costCenters(),
      queryFn: () => client.listCostCenters().then((r) => unwrap<Page<CostCenterDto>>(r)),
    }),
    costCenterAssignments: (client: ApiClient): QueryOption<Page<CostCenterAssignmentDto>> => ({
      queryKey: queryKeys.settings.costCenterAssignments(),
      queryFn: () => client.listCostCenterAssignments().then((r) => unwrap<Page<CostCenterAssignmentDto>>(r)),
    }),
    chargebackSettings: (client: ApiClient): QueryOption<ChargebackSettingsDto> => ({
      queryKey: queryKeys.settings.chargebackSettings(),
      queryFn: () => client.getChargebackSettings().then((r) => unwrap<ChargebackSettingsDto>(r)),
    }),
    chargebackReport: (client: ApiClient): QueryOption<ChargebackReportDto> => ({
      queryKey: queryKeys.settings.chargebackReport(),
      queryFn: () => client.getChargebackReport().then((r) => unwrap<ChargebackReportDto>(r)),
    }),
  },

  fmea: {
    list: (client: ApiClient): QueryOption<Page<FmeaDto>> => ({
      queryKey: queryKeys.fmea.list(),
      queryFn: () => client.listFmeas().then((r) => unwrap<Page<FmeaDto>>(r)),
    }),
    items: (client: ApiClient, fmeaId: string): QueryOption<Page<FmeaItemDto>> => ({
      queryKey: queryKeys.fmea.items(fmeaId),
      queryFn: () => client.listFmeaItems({ params: { id: fmeaId } }).then((r) => unwrap<Page<FmeaItemDto>>(r)),
    }),
  },

  msa: {
    list: (client: ApiClient, args?: Arg<"listMsaStudies">): QueryOption<Page<MsaStudyDto>> => ({
      queryKey: queryKeys.msa.list(args?.query),
      queryFn: () => client.listMsaStudies(args).then((r) => unwrap<Page<MsaStudyDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<MsaStudyDto> => ({
      queryKey: queryKeys.msa.detail(id),
      queryFn: () => client.getMsaStudy({ params: { id } }).then((r) => unwrap<MsaStudyDto>(r)),
    }),
    analysis: (client: ApiClient, id: string): QueryOption<MsaAnalysisResult> => ({
      queryKey: queryKeys.msa.analysis(id),
      queryFn: () => client.getMsaAnalysis({ params: { id } }).then((r) => unwrap<MsaAnalysisResult>(r)),
    }),
  },

  risks: {
    list: (client: ApiClient, args?: Arg<"listRisks">): QueryOption<Page<RiskDto>> => ({
      queryKey: queryKeys.risks.list(args?.query),
      queryFn: () => client.listRisks(args).then((r) => unwrap<Page<RiskDto>>(r)),
    }),
    summary: (client: ApiClient): QueryOption<RiskSummaryDto> => ({
      queryKey: queryKeys.risks.summary(),
      queryFn: () => client.getRisksSummary().then((r) => unwrap<RiskSummaryDto>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<RiskDto> => ({
      queryKey: queryKeys.risks.detail(id),
      queryFn: () => client.getRisk({ params: { id } }).then((r) => unwrap<RiskDto>(r)),
    }),
  },

  instruments: {
    list: (client: ApiClient, args?: Arg<"listInstruments">): QueryOption<Page<InstrumentDto>> => ({
      queryKey: queryKeys.instruments.list(args?.query),
      queryFn: () => client.listInstruments(args).then((r) => unwrap<Page<InstrumentDto>>(r)),
    }),
    summary: (client: ApiClient): QueryOption<InstrumentSummaryDto> => ({
      queryKey: queryKeys.instruments.summary(),
      queryFn: () => client.getInstrumentsSummary().then((r) => unwrap<InstrumentSummaryDto>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<InstrumentDto> => ({
      queryKey: queryKeys.instruments.detail(id),
      queryFn: () => client.getInstrument({ params: { id } }).then((r) => unwrap<InstrumentDto>(r)),
    }),
    calibrationEvents: (
      client: ApiClient,
      instrumentId: string,
      args?: { query?: Arg<"listCalibrationEvents">["query"] },
    ): QueryOption<Page<CalibrationEventDto>> => ({
      queryKey: queryKeys.instruments.calibrationEvents(instrumentId, args?.query),
      queryFn: () =>
        client
          .listCalibrationEvents({ params: { id: instrumentId }, query: args?.query ?? {} })
          .then((r) => unwrap<Page<CalibrationEventDto>>(r)),
    }),
  },

  reports: {
    list: (client: ApiClient): QueryOption<Page<ReportDefinitionDto>> => ({
      queryKey: queryKeys.reports.list(),
      queryFn: () => client.listReports().then((r) => unwrap<Page<ReportDefinitionDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<ReportDefinitionDto> => ({
      queryKey: queryKeys.reports.detail(id),
      queryFn: () => client.getReport({ params: { id } }).then((r) => unwrap<ReportDefinitionDto>(r)),
    }),
  },

  // Connector registry (09 §1). Whole surface is admin-only server-side
  // (integration:manage) — the DTO exposes `hasCredentials`, never the pointer.
  integrations: {
    list: (client: ApiClient): QueryOption<Page<IntegrationDto>> => ({
      queryKey: queryKeys.integrations.list(),
      queryFn: () => client.listIntegrations().then((r) => unwrap<Page<IntegrationDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<IntegrationDto> => ({
      queryKey: queryKeys.integrations.detail(id),
      queryFn: () => client.getIntegration({ params: { id } }).then((r) => unwrap<IntegrationDto>(r)),
    }),
    schema: (client: ApiClient, id: string): QueryOption<ConnectorSchemaResult> => ({
      queryKey: queryKeys.integrations.schema(id),
      queryFn: () => client.getIntegrationSchema({ params: { id } }).then((r) => unwrap<ConnectorSchemaResult>(r)),
    }),
    webhookPolicy: (client: ApiClient): QueryOption<WebhookPolicyDto> => ({
      queryKey: queryKeys.integrations.webhookPolicy(),
      queryFn: () => client.getWebhookPolicy().then((r) => unwrap<WebhookPolicyDto>(r)),
    }),
    events: (client: ApiClient, id: string): QueryOption<Page<IntegrationEventDto>> => ({
      queryKey: queryKeys.integrations.events(id),
      queryFn: () => client.listIntegrationEvents({ params: { id } }).then((r) => unwrap<Page<IntegrationEventDto>>(r)),
    }),
  },

  // Bulk-import pipeline (09 §6). Targets + saved profiles + runs; a run detail
  // carries the counts + row-level results. Admin/manager only (import:run).
  import: {
    targets: (client: ApiClient): QueryOption<ImportTargetsResult> => ({
      queryKey: queryKeys.import.targets(),
      queryFn: () => client.listImportTargets().then((r) => unwrap<ImportTargetsResult>(r)),
    }),
    profiles: (client: ApiClient): QueryOption<Page<ImportProfileDto>> => ({
      queryKey: queryKeys.import.profiles(),
      queryFn: () => client.listImportProfiles().then((r) => unwrap<Page<ImportProfileDto>>(r)),
    }),
    runs: (client: ApiClient): QueryOption<Page<ImportRunDto>> => ({
      queryKey: queryKeys.import.runs(),
      queryFn: () => client.listImportRuns().then((r) => unwrap<Page<ImportRunDto>>(r)),
    }),
    run: (client: ApiClient, id: string): QueryOption<ImportRunDto> => ({
      queryKey: queryKeys.import.run(id),
      queryFn: () => client.getImportRun({ params: { id } }).then((r) => unwrap<ImportRunDto>(r)),
    }),
  },

  // SPC analytics (B5). Characteristics + the computed X̄/R chart. Read-only
  // (spc:view); ingest is a mutation composed inline in the hook.
  spc: {
    characteristics: (client: ApiClient): QueryOption<SpcCharacteristicsResult> => ({
      queryKey: queryKeys.spc.characteristics(),
      queryFn: () => client.listSpcCharacteristics().then((r) => unwrap<SpcCharacteristicsResult>(r)),
    }),
    chart: (client: ApiClient, part: string, characteristic: string): QueryOption<SpcChartDto> => ({
      queryKey: queryKeys.spc.chart(part, characteristic),
      queryFn: () => client.getSpcChart({ query: { part, characteristic } }).then((r) => unwrap<SpcChartDto>(r)),
    }),
  },

  // Knowledge graph explorer (Sprint 03 G1-G4; graph-explorer.jsx). All three
  // routes require `graph:view`; the UI never calls fetch directly.
  graph: {
    seeds: (client: ApiClient): QueryOption<GraphSeedsResult> => ({
      queryKey: queryKeys.graph.seeds(),
      queryFn: () => client.listGraphSeeds().then((r) => unwrap<GraphSeedsResult>(r)),
    }),
    expand: (client: ApiClient, seed: string, type?: string, after?: string): QueryOption<GraphExpandResult> => ({
      queryKey: queryKeys.graph.expand(seed, type, after),
      queryFn: () =>
        client
          .expandGraph({ query: { seed, ...(type !== undefined ? { type: type as EntityKind } : {}), ...(after !== undefined ? { after } : {}) } })
          .then((r) => unwrap<GraphExpandResult>(r)),
    }),
    query: (client: ApiClient, queryId: GraphQueryId, focus?: string): QueryOption<GraphQueryResult> => ({
      queryKey: queryKeys.graph.query(queryId, focus),
      queryFn: () =>
        client
          .runGraphQuery({ params: { queryId }, query: focus !== undefined ? { focus } : {} })
          .then((r) => unwrap<GraphQueryResult>(r)),
    }),
  },

  // The query engine (B2): sources + the three run shapes. Each run is keyed on
  // the serialized Query so distinct tiles cache independently.
  query: {
    sources: (client: ApiClient): QueryOption<QuerySourcesResult> => ({
      queryKey: queryKeys.query.sources(),
      queryFn: () => client.listQuerySources().then((r) => unwrap<QuerySourcesResult>(r)),
    }),
    rows: (client: ApiClient, q: Query): QueryOption<QueryRowsResult> => ({
      queryKey: queryKeys.query.rows(JSON.stringify(q)),
      queryFn: () => client.runQuery({ body: q }).then((r) => unwrap<QueryRowsResult>(r)),
    }),
    metric: (client: ApiClient, q: Query): QueryOption<QueryMetricResult> => ({
      queryKey: queryKeys.query.metric(JSON.stringify(q)),
      queryFn: () => client.runQueryMetric({ body: q }).then((r) => unwrap<QueryMetricResult>(r)),
    }),
    series: (client: ApiClient, q: Query): QueryOption<QuerySeriesResult> => ({
      queryKey: queryKeys.query.series(JSON.stringify(q)),
      queryFn: () => client.runQuerySeries({ body: q }).then((r) => unwrap<QuerySeriesResult>(r)),
    }),
  },

  // Predictive risk (Sprint 03 Part B). Read-only end to end — the nightly
  // `predict-risk` job owns the data, no mutation here (P2/P21).
  predictions: {
    list: (client: ApiClient, args?: Arg<"listPredictions">): QueryOption<Page<RiskPredictionDto>> => ({
      queryKey: queryKeys.predictions.list(args?.query),
      queryFn: () => client.listPredictions(args).then((r) => unwrap<Page<RiskPredictionDto>>(r)),
    }),
    detail: (client: ApiClient, subjectKind: string, id: string): QueryOption<PredictionDetailResponse> => ({
      queryKey: queryKeys.predictions.detail(subjectKind, id),
      queryFn: () =>
        client
          .getPrediction({ params: { subjectKind: subjectKind as RiskPredictionDto["subjectKind"], id } })
          .then((r) => unwrap<PredictionDetailResponse>(r)),
    }),
  },

  // Training & competency (Sprint 05 T1-T5).
  competencies: {
    list: (client: ApiClient, args?: Arg<"listCompetencies">): QueryOption<Page<CompetencyDto>> => ({
      queryKey: queryKeys.competencies.list(args?.query),
      queryFn: () => client.listCompetencies(args).then((r) => unwrap<Page<CompetencyDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<CompetencyDto> => ({
      queryKey: queryKeys.competencies.detail(id),
      queryFn: () => client.getCompetency({ params: { id } }).then((r) => unwrap<CompetencyDto>(r)),
    }),
  },

  training: {
    matrix: (client: ApiClient, args?: Arg<"getTrainingMatrix">): QueryOption<Page<TrainingMatrixRowDto>> => ({
      queryKey: queryKeys.training.matrix(args?.query),
      queryFn: () => client.getTrainingMatrix(args).then((r) => unwrap<Page<TrainingMatrixRowDto>>(r)),
    }),
    summary: (client: ApiClient): QueryOption<TrainingSummaryDto> => ({
      queryKey: queryKeys.training.summary(),
      queryFn: () => client.getTrainingSummary().then((r) => unwrap<TrainingSummaryDto>(r)),
    }),
    gaps: (client: ApiClient, args?: Arg<"getTrainingGaps">): QueryOption<Page<TrainingGapDto>> => ({
      queryKey: queryKeys.training.gaps(args?.query),
      queryFn: () => client.getTrainingGaps(args).then((r) => unwrap<Page<TrainingGapDto>>(r)),
    }),
    records: (client: ApiClient, args: Arg<"listTrainingRecords">): QueryOption<Page<TrainingRecordDto>> => ({
      queryKey: queryKeys.training.records(args.query),
      queryFn: () => client.listTrainingRecords(args).then((r) => unwrap<Page<TrainingRecordDto>>(r)),
    }),
    record: (client: ApiClient, id: string): QueryOption<TrainingRecordDto> => ({
      queryKey: queryKeys.training.record(id),
      queryFn: () => client.getTrainingRecord({ params: { id } }).then((r) => unwrap<TrainingRecordDto>(r)),
    }),
  },
} as const;
