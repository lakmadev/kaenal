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
export const AUTHENTICATOR = Symbol("AUTHENTICATOR");
export const AUTH_SERVICE = Symbol("AUTH_SERVICE");
export const IDEMPOTENCY = Symbol("IDEMPOTENCY");
export const TEMPLATES_SERVICE = Symbol("TEMPLATES_SERVICE");
export const INSPECTIONS_SERVICE = Symbol("INSPECTIONS_SERVICE");
export const FINDINGS_SERVICE = Symbol("FINDINGS_SERVICE");
export const NCR_SERVICE = Symbol("NCR_SERVICE");
export const CAPA_SERVICE = Symbol("CAPA_SERVICE");
export const DOCUMENTS_SERVICE = Symbol("DOCUMENTS_SERVICE");
export const FILES_SERVICE = Symbol("FILES_SERVICE");
export const STORAGE = Symbol("STORAGE");
export const SEARCH_SERVICE = Symbol("SEARCH_SERVICE");
export const NOTIFICATIONS_SERVICE = Symbol("NOTIFICATIONS_SERVICE");
export const JOB_PRODUCER = Symbol("JOB_PRODUCER");
export const RATE_LIMITER = Symbol("RATE_LIMITER");
