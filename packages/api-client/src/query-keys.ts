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
  },

  query: {
    all: ["query"] as const,
    sources: () => ["query", "sources"] as const,
    rows: (key: string) => ["query", "rows", key] as const,
    metric: (key: string) => ["query", "metric", key] as const,
    series: (key: string) => ["query", "series", key] as const,
  },
} as const;
