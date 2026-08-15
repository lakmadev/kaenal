import Constants from "expo-constants";

import { createApiClient, type ApiClient } from "@kaenal/api-client";

import { useSession } from "@/stores/session";

/** Port the local API dev server listens on (docker/compose + `pnpm … api dev`). */
const DEV_API_PORT = 3001;

/**
 * The API origin the local dev API is reachable at.
 *
 * A physical phone loads the JS bundle from your machine's LAN IP (e.g.
 * `192.168.1.23:8081`), NOT `localhost` — on the device `localhost` is the phone
 * itself, which is why sign-in failed with "cannot reach server". Expo exposes that
 * host, so we reuse its IP with the API port. Web and the simulator run on the same
 * machine, so their host resolves to `localhost` and we keep that. An explicit
 * EXPO_PUBLIC_API_URL always wins (staging / device builds / tunnels).
 */
function inferDevApiBase(): string {
  // e.g. "192.168.1.23:8081" (dev client / Expo Go) — falls back across SDK shapes.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest2?.extra?.expoClient?.hostUri as string | undefined);
  const host = hostUri?.split(":")[0]?.trim();
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${DEV_API_PORT}`;
  }
  return `http://localhost:${DEV_API_PORT}`;
}

/**
 * API origin. Set EXPO_PUBLIC_API_URL for device/staging builds; otherwise the LAN
 * IP of the Expo dev server is used so a physical phone can reach your dev API.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? inferDevApiBase();

// One stable client for the app lifetime. Tenant + token are getters into the
// session store, so the same instance follows the active workspace and session
// across sign-in / workspace-switch without being recreated. Bearer auth means no
// cookies/CSRF (the client skips CSRF when a token is present).
export const apiClient: ApiClient = createApiClient({
  baseUrl: API_BASE_URL,
  tenant: () => useSession.getState().tenant ?? undefined,
  token: () => useSession.getState().token ?? undefined,
});
