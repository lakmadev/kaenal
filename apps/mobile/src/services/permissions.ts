import { Alert, Linking, Platform } from "react-native";

// Unified runtime-permission flow (05 §3). One place that: (1) requests a permission
// when a feature needs it, (2) re-asks if the OS still allows it, and (3) when the
// user has permanently denied it (can't ask again), explains and offers to open the
// system Settings. Features call `ensurePermission(kind, feature)` right before they
// use hardware — never at app start — matching the design's "confirm each when the
// feature runs" priming.

export type PermKind = "camera" | "location" | "notifications";
export type PermState = "granted" | "denied" | "blocked" | "unsupported";

interface NativeResult {
  granted: boolean;
  canAskAgain: boolean;
}

function label(kind: PermKind): string {
  return kind === "camera" ? "Camera" : kind === "location" ? "Location" : "Notifications";
}

async function nativeGet(kind: PermKind): Promise<NativeResult> {
  if (kind === "camera") {
    const IP = require("expo-image-picker") as typeof import("expo-image-picker");
    const p = await IP.getCameraPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  }
  if (kind === "location") {
    const L = require("expo-location") as typeof import("expo-location");
    const p = await L.getForegroundPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  }
  const N = require("expo-notifications") as typeof import("expo-notifications");
  const p = await N.getPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

async function nativeRequest(kind: PermKind): Promise<NativeResult> {
  if (kind === "camera") {
    const IP = require("expo-image-picker") as typeof import("expo-image-picker");
    const p = await IP.requestCameraPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  }
  if (kind === "location") {
    const L = require("expo-location") as typeof import("expo-location");
    const p = await L.requestForegroundPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  }
  const N = require("expo-notifications") as typeof import("expo-notifications");
  const p = await N.requestPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

/** Read the current state without prompting. */
export async function checkPermission(kind: PermKind): Promise<PermState> {
  if (Platform.OS === "web") {
    // The browser gates camera (file dialog) / geolocation inline at use; treat as
    // available so features proceed and the browser shows its own prompt.
    if (kind === "location") {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unsupported";
      // Browsers only prompt for / allow geolocation on a SECURE origin (HTTPS or
      // localhost). An installed PWA served over plain http://<lan-ip> is NOT a
      // secure context, so Safari never prompts and getCurrentPosition just fails —
      // report "unsupported" so the UI explains it instead of spinning "Locating…".
      if (typeof window !== "undefined" && window.isSecureContext === false) return "unsupported";
      return "granted";
    }
    return "granted";
  }
  const r = await nativeGet(kind);
  return r.granted ? "granted" : r.canAskAgain ? "denied" : "blocked";
}

/**
 * Ensure a permission before using a feature. Requests it if not yet granted;
 * re-asks when the OS still allows a prompt; and when it's permanently blocked,
 * shows a "grant it in Settings" alert (with an Open Settings button) — so a user
 * who declined once, then taps the feature, is guided correctly instead of hitting
 * a silent no-op. Returns the final state; callers proceed only on "granted".
 */
export async function ensurePermission(
  kind: PermKind,
  feature: string,
  opts: { promptSettings?: boolean } = {},
): Promise<PermState> {
  const { promptSettings = true } = opts;
  if (Platform.OS === "web") return checkPermission(kind);

  const current = await nativeGet(kind);
  if (current.granted) return "granted";

  // Not granted yet — ask, as long as the OS will still show the prompt. This is
  // the "ask once again" path: undetermined OR previously-denied-but-askable.
  if (current.canAskAgain) {
    const asked = await nativeRequest(kind);
    if (asked.granted) return "granted";
    if (asked.canAskAgain) return "denied"; // user dismissed; try again next time
    // Fall through: they just chose "Don't allow" → now blocked.
  }

  // Permanently blocked. For an explicit action (camera tap) we explain + offer
  // Settings; for a background auto-stamp (location on open) we stay quiet and let
  // the caller surface a tappable hint instead of popping a modal every time.
  if (promptSettings) promptOpenSettings(kind, feature);
  return "blocked";
}

/** The "enable it in Settings" alert for a permanently-denied permission. */
export function promptOpenSettings(kind: PermKind, feature: string): void {
  if (Platform.OS === "web") return;
  Alert.alert(
    `${label(kind)} access needed`,
    `${feature} needs ${label(kind).toLowerCase()} access. Turn it on for Kaenal in Settings, then try again.`,
    [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ],
  );
}
