import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { useHaptics } from "@/stores/haptics";

// Thin, safe wrapper over expo-haptics. Every call is a no-op on web (unsupported)
// and when the user has turned haptics off (persisted preference), and never
// throws — a missing Taptic Engine or an unsupported device must not break a tap.

function on(): boolean {
  return Platform.OS !== "web" && useHaptics.getState().enabled;
}

/** A light tap — the default for a button/row press. */
export function tapLight(): void {
  if (!on()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** A slightly firmer tap — for a primary/confirming action. */
export function tapMedium(): void {
  if (!on()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** A crisp selection tick — for switching tabs, chips, segmented controls. */
export function tapSelection(): void {
  if (!on()) return;
  void Haptics.selectionAsync().catch(() => undefined);
}

/** Success / warning / error notification patterns — for the end of an action. */
export function notify(kind: "success" | "warning" | "error"): void {
  if (!on()) return;
  const map = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
  } as const;
  void Haptics.notificationAsync(map[kind]).catch(() => undefined);
}
