/**
 * Query-key factory (TanStack Query). Centralising the keys keeps invalidation
 * honest: a mutation invalidates `queryKeys.ncrs.all` and every list/detail
 * under it updates, with no stringly-typed keys drifting across the app.
 */
export const queryKeys = {
  me: () => ["me"] as const,
  workspaces: () => ["workspaces"] as const,

  members: {
    all: ["members"] as const,
    list: (params?: unknown) => ["members", "list", params ?? null] as const,
  },

  search: (q: string) => ["search", q] as const,

  inspections: {
    all: ["inspections"] as const,
    list: (params?: unknown) => ["inspections", "list", params ?? null] as const,
    detail: (id: string) => ["inspections", "detail", id] as const,
    findings: (id: string) => ["inspections", id, "findings"] as const,
  },

  ncrs: {
    all: ["ncrs"] as const,
    list: (params?: unknown) => ["ncrs", "list", params ?? null] as const,
    detail: (id: string) => ["ncrs", "detail", id] as const,
    actions: (id: string) => ["ncrs", id, "actions"] as const,
  },

  capas: {
    all: ["capas"] as const,
    list: (params?: unknown) => ["capas", "list", params ?? null] as const,
    detail: (id: string) => ["capas", "detail", id] as const,
    actions: (id: string) => ["capas", id, "actions"] as const,
  },

  audits: {
    all: ["audits"] as const,
    list: (params?: unknown) => ["audits", "list", params ?? null] as const,
    detail: (id: string) => ["audits", "detail", id] as const,
    findings: (id: string) => ["audits", id, "findings"] as const,
    frequency: () => ["audits", "frequency"] as const,
    stats: () => ["audits", "stats"] as const,
  },

  documents: {
    all: ["documents"] as const,
    list: (params?: unknown) => ["documents", "list", params ?? null] as const,
    detail: (id: string) => ["documents", "detail", id] as const,
    versions: (id: string) => ["documents", id, "versions"] as const,
  },

  suppliers: {
    all: ["suppliers"] as const,
    list: (params?: unknown) => ["suppliers", "list", params ?? null] as const,
    detail: (id: string) => ["suppliers", "detail", id] as const,
    scorecard: (params?: unknown) => ["suppliers", "scorecard", params ?? null] as const,
  },

  ppap: {
    all: ["ppap"] as const,
    list: (params?: unknown) => ["ppap", "list", params ?? null] as const,
    detail: (id: string) => ["ppap", "detail", id] as const,
  },

  scars: {
    all: ["scars"] as const,
    list: (params?: unknown) => ["scars", "list", params ?? null] as const,
    detail: (id: string) => ["scars", "detail", id] as const,
  },

  eightDs: {
    all: ["eightDs"] as const,
    list: (params?: unknown) => ["eightDs", "list", params ?? null] as const,
    detail: (id: string) => ["eightDs", "detail", id] as const,
  },

  portal: {
    all: ["portal"] as const,
    identity: () => ["portal", "me"] as const,
    scars: (params?: unknown) => ["portal", "scars", params ?? null] as const,
    scar: (id: string) => ["portal", "scars", "detail", id] as const,
    ppapList: (params?: unknown) => ["portal", "ppap", params ?? null] as const,
    ppap: (id: string) => ["portal", "ppap", "detail", id] as const,
  },

  files: {
    detail: (id: string) => ["files", "detail", id] as const,
  },

  comments: {
    all: ["comments"] as const,
    list: (entityKind: string, entityId: string) => ["comments", entityKind, entityId] as const,
  },

  entityLinks: {
    all: ["entity-links"] as const,
    list: (entityKind: string, entityId: string) => ["entity-links", entityKind, entityId] as const,
  },

  auditEvents: {
    list: (entityKind: string, entityId: string) => ["audit-events", entityKind, entityId] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (params?: unknown) => ["notifications", "list", params ?? null] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
    prefs: () => ["notification-prefs"] as const,
  },

  settings: {
    all: ["settings"] as const,
    branding: () => ["settings", "branding"] as const,
    sessionPolicy: () => ["settings", "session-policy"] as const,
    ncrRules: () => ["settings", "ncr-validation-rules"] as const,
    legalHolds: () => ["settings", "legal-holds"] as const,
    dlpPolicies: () => ["settings", "dlp-policies"] as const,
    costCenters: () => ["settings", "cost-centers"] as const,
    costCenterAssignments: () => ["settings", "cost-center-assignments"] as const,
    chargebackSettings: () => ["settings", "chargeback"] as const,
    chargebackReport: () => ["settings", "chargeback-report"] as const,
  },

  fmea: {
    all: ["fmea"] as const,
    list: () => ["fmea", "list"] as const,
    items: (fmeaId: string) => ["fmea", "items", fmeaId] as const,
  },

  msa: {
    all: ["msa"] as const,
    list: (params?: unknown) => ["msa", "list", params ?? null] as const,
    detail: (id: string) => ["msa", "detail", id] as const,
    analysis: (id: string) => ["msa", id, "analysis"] as const,
  },

  reports: {
    all: ["reports"] as const,
    list: () => ["reports", "list"] as const,
    detail: (id: string) => ["reports", "detail", id] as const,
  },

  integrations: {
    all: ["integrations"] as const,
    list: () => ["integrations", "list"] as const,
    detail: (id: string) => ["integrations", "detail", id] as const,
    schema: (id: string) => ["integrations", "schema", id] as const,
    events: (id: string) => ["integrations", "events", id] as const,
    webhookPolicy: () => ["integrations", "webhook-policy"] as const,
  },

  import: {
    all: ["import"] as const,
    targets: () => ["import", "targets"] as const,
    profiles: () => ["import", "profiles"] as const,
    runs: () => ["import", "runs"] as const,
    run: (id: string) => ["import", "run", id] as const,
  },

  spc: {
    all: ["spc"] as const,
    characteristics: () => ["spc", "characteristics"] as const,
    chart: (part: string, characteristic: string) => ["spc", "chart", part, characteristic] as const,
  },

  graph: {
    all: ["graph"] as const,
    seeds: () => ["graph", "seeds"] as const,
    expand: (seed: string, type?: string, after?: string) => ["graph", "expand", seed, type ?? null, after ?? null] as const,
    query: (queryId: string, focus?: string) => ["graph", "query", queryId, focus ?? null] as const,
  },

  query: {
    all: ["query"] as const,
    sources: () => ["query", "sources"] as const,
    rows: (key: string) => ["query", "rows", key] as const,
    metric: (key: string) => ["query", "metric", key] as const,
    series: (key: string) => ["query", "series", key] as const,
  },

  risks: {
    all: ["risks"] as const,
    list: (params?: unknown) => ["risks", "list", params ?? null] as const,
    detail: (id: string) => ["risks", "detail", id] as const,
    summary: () => ["risks", "summary"] as const,
  },

  instruments: {
    all: ["instruments"] as const,
    list: (params?: unknown) => ["instruments", "list", params ?? null] as const,
    detail: (id: string) => ["instruments", "detail", id] as const,
    summary: () => ["instruments", "summary"] as const,
    calibrationEvents: (instrumentId: string, params?: unknown) =>
      ["instruments", "detail", instrumentId, "calibration-events", params ?? null] as const,
  },

  predictions: {
    all: ["predictions"] as const,
    list: (params?: unknown) => ["predictions", "list", params ?? null] as const,
    detail: (subjectKind: string, id: string) => ["predictions", "detail", subjectKind, id] as const,
  },

  competencies: {
    all: ["competencies"] as const,
    list: (params?: unknown) => ["competencies", "list", params ?? null] as const,
    detail: (id: string) => ["competencies", "detail", id] as const,
  },

  training: {
    all: ["training"] as const,
    matrix: (params?: unknown) => ["training", "matrix", params ?? null] as const,
    summary: () => ["training", "summary"] as const,
    gaps: (params?: unknown) => ["training", "gaps", params ?? null] as const,
    records: (params?: unknown) => ["training", "records", params ?? null] as const,
    record: (id: string) => ["training", "record", id] as const,
  },

  complaints: {
    all: ["complaints"] as const,
    list: (params?: unknown) => ["complaints", "list", params ?? null] as const,
    detail: (id: string) => ["complaints", "detail", id] as const,
    summary: () => ["complaints", "summary"] as const,
  },

  ecns: {
    all: ["ecns"] as const,
    list: (params?: unknown) => ["ecns", "list", params ?? null] as const,
    detail: (id: string) => ["ecns", "detail", id] as const,
    summary: () => ["ecns", "summary"] as const,
    approvals: (id: string) => ["ecns", "approvals", id] as const,
    links: (id: string) => ["ecns", "links", id] as const,
  },
} as const;
