import { createApiClient, type ApiClient } from "@kaenal/api-client";

import { useSession } from "@/stores/session";

/**
 * API origin. Set EXPO_PUBLIC_API_URL for device/staging builds; defaults to the
 * local API for web/simulator dev. (A physical device can't reach `localhost` —
 * point it at your machine's LAN IP or a tunnel.)
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// One stable client for the app lifetime. Tenant + token are getters into the
// session store, so the same instance follows the active workspace and session
// across sign-in / workspace-switch without being recreated. Bearer auth means no
// cookies/CSRF (the client skips CSRF when a token is present).
export const apiClient: ApiClient = createApiClient({
  baseUrl: API_BASE_URL,
  tenant: () => useSession.getState().tenant ?? undefined,
  token: () => useSession.getState().token ?? undefined,
});
