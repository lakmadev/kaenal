/**
 * Query-key factory (TanStack Query). Centralising the keys keeps invalidation
 * honest: a mutation invalidates `queryKeys.ncrs.all` and every list/detail
 * under it updates, with no stringly-typed keys drifting across the app.
 */
export const queryKeys = {
  me: () => ["me"] as const,

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
} as const;
