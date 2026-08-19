import Constants from "expo-constants";
import { Platform } from "react-native";

// Real app identity from the Expo config / native build — never a hard-coded string.
// version = app.json `version`; buildNumber = iOS build / Android versionCode when present.

export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";

export const APP_BUILD: string =
  (Platform.OS === "ios"
    ? Constants.expoConfig?.ios?.buildNumber
    : Platform.OS === "android"
      ? Constants.expoConfig?.android?.versionCode?.toString()
      : undefined) ?? "—";

export const APP_NAME: string = Constants.expoConfig?.name ?? "Kaenal";

/** OTA update / build channel when running an EAS build (dev/preview/production). */
export const APP_CHANNEL: string =
  (Constants.expoConfig as { updates?: { channel?: string } } | null)?.updates?.channel ??
  ((Constants as unknown as { easConfig?: { channel?: string } }).easConfig?.channel ?? "development");

export const RUNTIME: string = `Expo SDK ${Constants.expoConfig?.sdkVersion ?? "—"} · ${Platform.OS}`;
