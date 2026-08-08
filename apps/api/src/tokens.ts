/**
 * Injection tokens.
 *
 * Every provider is injected by explicit token rather than by type, because
 * emitDecoratorMetadata is off (see tsconfig.json): type-based injection would
 * compile but resolve to `undefined` under esbuild.
 */
export const ENV = Symbol("ENV");
export const REDIS = Symbol("REDIS");
export const CONTROL_POOL = Symbol("CONTROL_POOL");
export const TENANT_REGISTRY = Symbol("TENANT_REGISTRY");
export const TENANT_POOLS = Symbol("TENANT_POOLS");
export const SECRET_RESOLVER = Symbol("SECRET_RESOLVER");
export const AUTHENTICATOR = Symbol("AUTHENTICATOR");
export const AUTH_SERVICE = Symbol("AUTH_SERVICE");
export const MEMBERS_SERVICE = Symbol("MEMBERS_SERVICE");
export const IDEMPOTENCY = Symbol("IDEMPOTENCY");
export const TEMPLATES_SERVICE = Symbol("TEMPLATES_SERVICE");
export const INSPECTIONS_SERVICE = Symbol("INSPECTIONS_SERVICE");
export const FINDINGS_SERVICE = Symbol("FINDINGS_SERVICE");
export const NCR_SERVICE = Symbol("NCR_SERVICE");
export const CAPA_SERVICE = Symbol("CAPA_SERVICE");
export const EIGHT_D_SERVICE = Symbol("EIGHT_D_SERVICE");
export const AUDITS_SERVICE = Symbol("AUDITS_SERVICE");
export const DOCUMENTS_SERVICE = Symbol("DOCUMENTS_SERVICE");
export const SUPPLIERS_SERVICE = Symbol("SUPPLIERS_SERVICE");
export const PPAP_SERVICE = Symbol("PPAP_SERVICE");
export const SCAR_SERVICE = Symbol("SCAR_SERVICE");
export const PORTAL_SERVICE = Symbol("PORTAL_SERVICE");
export const FILES_SERVICE = Symbol("FILES_SERVICE");
export const EXPORTS_SERVICE = Symbol("EXPORTS_SERVICE");
export const AI_GATEWAY = Symbol("AI_GATEWAY");
export const AI_SERVICE = Symbol("AI_SERVICE");
export const STORAGE = Symbol("STORAGE");
export const SEARCH_SERVICE = Symbol("SEARCH_SERVICE");
export const NOTIFICATIONS_SERVICE = Symbol("NOTIFICATIONS_SERVICE");
export const COMMENTS_SERVICE = Symbol("COMMENTS_SERVICE");
export const AUDIT_LOG_SERVICE = Symbol("AUDIT_LOG_SERVICE");
export const ENTITY_LINKS_SERVICE = Symbol("ENTITY_LINKS_SERVICE");
export const SETTINGS_SERVICE = Symbol("SETTINGS_SERVICE");
export const NCR_RULES_SERVICE = Symbol("NCR_RULES_SERVICE");
export const LEGAL_HOLDS_SERVICE = Symbol("LEGAL_HOLDS_SERVICE");
export const DLP_POLICIES_SERVICE = Symbol("DLP_POLICIES_SERVICE");
export const COST_CENTERS_SERVICE = Symbol("COST_CENTERS_SERVICE");
export const JOB_PRODUCER = Symbol("JOB_PRODUCER");
export const RATE_LIMITER = Symbol("RATE_LIMITER");
