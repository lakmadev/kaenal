import { Platform } from "react-native";

import type { Coordinates, LocationPort } from "./ports";

// GPS location (05 §M7 auto-stamp) behind the LocationPort. expo-location on
// device; the browser's Geolocation API on web. Permission-gated and degrades to
// null so a capture never blocks on location. Lazy-required per platform.
export const locationAdapter: LocationPort = {
  async requestPermission() {
    if (Platform.OS === "web") {
      return typeof navigator !== "undefined" && "geolocation" in navigator;
    }
    const Location = require("expo-location") as typeof import("expo-location");
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  },

  async current(): Promise<Coordinates | null> {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) return null;
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 8000 },
        );
      });
    }
    const Location = require("expo-location") as typeof import("expo-location");
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch {
      return null;
    }
  },
};
