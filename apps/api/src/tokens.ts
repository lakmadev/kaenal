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
