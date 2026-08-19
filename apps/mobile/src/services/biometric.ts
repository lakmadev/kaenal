import { Platform } from "react-native";

import type { BiometricPort } from "./ports";

// Biometric unlock (05 §3) behind the BiometricPort. Uses expo-local-authentication
// on device; on web it reports unavailable so the app falls back to password unlock.
// Lazy-required so the web bundle never loads the native module.
export const biometricAdapter: BiometricPort = {
  async isAvailable() {
    if (Platform.OS === "web") return false;
    const LA = require("expo-local-authentication") as typeof import("expo-local-authentication");
    const [hasHardware, enrolled] = await Promise.all([LA.hasHardwareAsync(), LA.isEnrolledAsync()]);
    return hasHardware && enrolled;
  },

  async authenticate(reason: string) {
    if (Platform.OS === "web") return false;
    const LA = require("expo-local-authentication") as typeof import("expo-local-authentication");
    const res = await LA.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false });
    return res.success;
  },
};
