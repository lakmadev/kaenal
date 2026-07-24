import { createApiClient, type ApiClient } from "@kaenal/api-client";
import { env } from "@/lib/env";
import { getActiveTenant } from "@/lib/tenant";

/**
 * The single browser-side API client (04 §1 — "all data via the typed hooks").
 * Framework-agnostic ts-rest client from `@kaenal/api-client`, wired for the web:
 *
 *  - `credentials: "include"` so the httpOnly session cookie rides along;
 *  - `tenant` is a GETTER reading the active-workspace cookie, so one client
 *    instance follows the workspace across a switch without being rebuilt;
 *  - CSRF is handled inside the client (it reads the `kaenal_csrf` cookie and
 *    echoes it on unsafe methods — the double-submit contract, 07 §4).
 *
 * There is exactly one instance; components never `fetch` directly.
 */
let client: ApiClient | undefined;

export function getApiClient(): ApiClient {
  client ??= createApiClient({
    baseUrl: env.apiBaseUrl,
    credentials: "include",
    tenant: () => getActiveTenant(),
  });
  return client;
}
