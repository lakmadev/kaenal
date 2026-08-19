import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { registerPushToken, unregisterPushToken } from "@/lib/account-api";
import { entityRoute } from "@/lib/deep-links";
import { services } from "@/services";
import { onNotificationResponse } from "@/services/notifications";

const PUSH_TOKEN_KEY = "kaenal.push.token";

/**
 * Ask for notification permission, resolve the device's Expo push token, and
 * register it with the server (05 §3, registry 0036) so server-originated push
 * (assignment, escalation, …) can reach this device. The token is also cached
 * locally so sign-out can deregister it. A failed upload is non-fatal — the local
 * "sync failed" alerts + deep-link-on-tap still work.
 */
export async function registerForPushAsync(): Promise<string | null> {
  const token = (await services.notifications?.getPushToken?.()) ?? null;
  if (!token) return null;
  await services.kv.setItem(PUSH_TOKEN_KEY, token);
  try {
    await registerPushToken(token, Platform.OS);
  } catch {
    /* offline / transient — the token is cached and re-registers next launch */
  }
  return token;
}

/** Deregister this device's push token (called on sign-out). Best-effort. */
export async function unregisterForPushAsync(): Promise<void> {
  const token = await services.kv.getItem(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await unregisterPushToken(token);
  } catch {
    /* offline — the server keeps a stale token; it'll be reassigned on next register */
  }
  await services.kv.removeItem(PUSH_TOKEN_KEY);
}

/**
 * Route notification taps into the app. Installs a response listener (foreground
 * + cold-start) that maps the notification's entity reference to a route via the
 * shared deep-link resolver. Mount once, high in the tree (root layout).
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  useEffect(() => {
    return onNotificationResponse((data) => {
      const href = entityRoute(data?.entityKind, data?.entityId);
      if (href) router.push(href);
    });
  }, [router]);
}
