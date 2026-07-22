import { initClient, tsRestFetchApi, type ApiFetcher } from "@ts-rest/core";
import { contract } from "@kaenal/types";

/**
 * The tenant header the API resolves the workspace from (01 §3.3). The web app
 * usually resolves the tenant by subdomain; the mobile app and any explicit
 * cross-origin caller send it as a header.
 */
export const TENANT_HEADER = "x-tenant-id";
/** Double-submit CSRF: the non-httpOnly cookie the server sets… */
export const CSRF_COOKIE = "kaenal_csrf";
/** …echoed back in this header on unsafe cookie-authenticated requests (07 §4). */
export const CSRF_HEADER = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Resolvable<T> = T | (() => T | undefined) | undefined;

function resolve<T>(value: Resolvable<T>): T | undefined {
  return typeof value === "function" ? (value as () => T | undefined)() : value;
}

/** Read a browser cookie by name; returns undefined off the browser (RN/SSR). */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.split("=");
    if (k?.trim() === name) return decodeURIComponent(rest.join("=").trim());
  }
  return undefined;
}

export interface ApiClientOptions {
  /** API origin, e.g. `https://api.kaenal.app` or `http://localhost:3001`. */
  baseUrl: string;
  /**
   * Workspace slug → `X-Tenant-Id`. A value or a getter (so the same client can
   * follow the active workspace after a switch). Omit when the server resolves
   * the tenant by subdomain.
   */
  tenant?: Resolvable<string>;
  /**
   * Bearer token for the mobile app. When set, the client authenticates by
   * `Authorization: Bearer …` and skips CSRF (a bearer is not CSRF-vulnerable).
   * The web app leaves this unset and relies on the session cookie.
   */
  token?: Resolvable<string>;
  /**
   * Whether to send cookies. The web app needs `"include"` (or `"same-origin"`)
   * so the httpOnly session cookie rides along; the mobile app omits it.
   */
  credentials?: RequestCredentials;
  /**
   * CSRF token for cookie-authenticated mutations. Defaults to reading the
   * `kaenal_csrf` cookie, which is exactly the double-submit contract.
   */
  csrfToken?: Resolvable<string>;
}

function buildHeaders(
  base: Record<string, string>,
  method: string,
  opts: ApiClientOptions,
): Record<string, string> {
  const headers = { ...base };

  const tenant = resolve(opts.tenant);
  if (tenant !== undefined && tenant !== "") headers[TENANT_HEADER] = tenant;

  const token = resolve(opts.token);
  if (token !== undefined && token !== "") {
    headers["authorization"] = `Bearer ${token}`;
    return headers; // bearer auth: no CSRF needed
  }

  // Cookie auth: echo the CSRF token on unsafe methods (double-submit).
  if (!SAFE_METHODS.has(method.toUpperCase())) {
    const csrf = resolve(opts.csrfToken) ?? readCookie(CSRF_COOKIE);
    if (csrf !== undefined && csrf !== "") headers[CSRF_HEADER] = csrf;
  }
  return headers;
}

/**
 * A fully-typed client over the ts-rest contract (03 §1) — the single artifact
 * the API, its OpenAPI doc and every client share, so requests and responses
 * cannot drift. Each method returns a discriminated union on `status`
 * (`res.status === 200 ? res.body : …`), so callers handle errors as data.
 *
 * The client is framework-agnostic (plain `fetch`), so it runs in the browser,
 * React Native and on a server; the tenant/auth/CSRF wiring is threaded through
 * a custom fetcher rather than baked into headers, so a single client instance
 * can follow the active workspace and session over time.
 */
export function createApiClient(opts: ApiClientOptions) {
  const api: ApiFetcher = (args) =>
    tsRestFetchApi({ ...args, headers: buildHeaders(args.headers, args.method, opts) });

  return initClient(contract, {
    baseUrl: opts.baseUrl,
    baseHeaders: {},
    api,
    ...(opts.credentials !== undefined ? { credentials: opts.credentials } : {}),
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
