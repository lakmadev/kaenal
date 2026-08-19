import Constants from "expo-constants";
import { Platform } from "react-native";

import type { NotificationsPort } from "./ports";

// Push + local notifications (05 §3) behind the NotificationsPort. Uses
// expo-notifications on device; on web it reports unavailable so nothing native
// is touched. Lazy-required so the web bundle never loads the native module.
//
// Scope note (honest gap): there is no device-token registry endpoint in the
// shared contract yet, so `getPushToken()` returns the Expo push token for the
// caller to register once that endpoint lands (see `registerPushToken` in
// features/notifications). The *local* notification + deep-link-on-tap path is
// fully real and needs no backend — that's what powers "sync failed" alerts.

type ExpoNotifications = typeof import("expo-notifications");
function mod(): ExpoNotifications {
  return require("expo-notifications") as ExpoNotifications;
}

let handlerSet = false;
/** Install the foreground presentation handler once (banner + list, no sound spam). */
function ensureHandler(): void {
  if (handlerSet || Platform.OS === "web") return;
  handlerSet = true;
  mod().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

export const notificationsAdapter: NotificationsPort = {
  async requestPermission() {
    if (Platform.OS === "web") return false;
    const N = mod();
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    const req = await N.requestPermissionsAsync();
    return req.granted;
  },

  async getPushToken() {
    if (Platform.OS === "web") return null;
    const N = mod();
    if (!(await this.requestPermission())) return null;
    // Android needs a channel before tokens/notifications behave (05 §3).
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Kaenal",
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    try {
      const token = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      return token.data;
    } catch {
      // No projectId (dev / not an EAS build) — a real device token needs one.
      return null;
    }
  },
};

/**
 * Fire a local notification immediately (no server round-trip). Used for
 * sync-failed alerts, which the offline engine raises entirely on-device. The
 * `data` payload carries the entity reference the response handler deep-links on.
 */
export async function presentLocal(
  title: string,
  body: string,
  data?: { entityKind?: string | null; entityId?: string | null },
): Promise<void> {
  if (Platform.OS === "web") return;
  ensureHandler();
  await mod().scheduleNotificationAsync({
    content: { title, body, data: data ?? {} },
    trigger: null, // deliver now
  });
}

/**
 * Subscribe to notification taps (foreground + cold-start). Returns an unsubscribe
 * fn. The callback receives the `data` payload we attach (`entityKind`/`entityId`)
 * so the root layout can route via the deep-link resolver. No-op on web.
 */
export function onNotificationResponse(
  cb: (data: { entityKind?: string | null; entityId?: string | null }) => void,
): () => void {
  if (Platform.OS === "web") return () => {};
  const N = mod();
  ensureHandler();

  // Cold-start: the app was opened *by* tapping a notification.
  void N.getLastNotificationResponseAsync().then((res) => {
    const data = res?.notification.request.content.data;
    if (data) cb(data as { entityKind?: string | null; entityId?: string | null });
  });

  const sub = N.addNotificationResponseReceivedListener((res) => {
    cb(res.notification.request.content.data as { entityKind?: string | null; entityId?: string | null });
  });
  return () => sub.remove();
}
