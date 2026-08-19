import Constants from "expo-constants";
import { Platform } from "react-native";

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
  // Web (including the installed PWA / "Add to Home Screen"): the browser loaded
  // the app from some host — reuse EXACTLY that host with the API port. On a phone
  // that's your machine's LAN IP (e.g. 192.168.178.35), NOT `localhost` (which on
  // the device is the phone itself — the cause of "cannot reach server"). This is
  // more reliable than Expo's hostUri, which only reflects the native dev client.
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
  }

  // Native dev client / Expo Go: Expo exposes the dev-server host.
  // e.g. "192.168.1.23:8081" — falls back across SDK shapes.
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
