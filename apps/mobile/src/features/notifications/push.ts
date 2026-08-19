import { useRouter } from "expo-router";
import { useEffect } from "react";

import { entityRoute } from "@/lib/deep-links";
import { services } from "@/services";
import { onNotificationResponse } from "@/services/notifications";

const PUSH_TOKEN_KEY = "kaenal.push.token";

/**
 * Ask for notification permission and resolve the device's Expo push token
 * (05 §3). The token is cached locally so it's ready to send the moment a device
 * registry endpoint exists.
 *
 * HONEST GAP: the shared API contract has no `registerDevice` / push-token route
 * yet, so the token is NOT uploaded — server-originated push (assignment,
 * due-soon) can't be delivered until that endpoint lands. The on-device path
 * (local "sync failed" alerts + deep-link-on-tap) works today without it.
 * When the endpoint arrives, POST the cached token here — nothing else changes.
 */
export async function registerForPushAsync(): Promise<string | null> {
  const token = (await services.notifications?.getPushToken?.()) ?? null;
  if (token) await services.kv.setItem(PUSH_TOKEN_KEY, token);
  return token;
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
