import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { kvAdapter } from "./kv";
import type { SecureStorePort } from "./ports";

// Secret store backed by the OS keychain/keystore via expo-secure-store.
// expo-secure-store is NOT available on web, so on the web dev-preview surface we
// fall back to the KV store (localStorage). That fallback is dev-only — native
// builds always use the hardware-backed keystore.
const isWeb = Platform.OS === "web";

export const secureStoreAdapter: SecureStorePort = {
  getItem: (key) => (isWeb ? kvAdapter.getItem(key) : SecureStore.getItemAsync(key)),
  setItem: (key, value) => (isWeb ? kvAdapter.setItem(key, value) : SecureStore.setItemAsync(key, value)),
  removeItem: (key) => (isWeb ? kvAdapter.removeItem(key) : SecureStore.deleteItemAsync(key)),
};
