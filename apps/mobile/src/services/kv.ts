import AsyncStorage from "@react-native-async-storage/async-storage";

import type { KvPort } from "./ports";

// KV adapter backed by AsyncStorage (localStorage on web). Non-secret data only.
export const kvAdapter: KvPort = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
