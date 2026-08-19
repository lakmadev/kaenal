// Native resolution of the sync store (Metro picks this on iOS/Android). Isolating
// the expo-sqlite import in a `.native` file keeps it out of the web bundle entirely
// — expo-sqlite's web build pulls in a wasm worker Metro can't bundle for the PWA.
import { createSqliteSyncStore } from "./sqlite-store.js";
import type { SyncStorePort } from "../ports.js";

export function createSyncStore(): SyncStorePort {
  return createSqliteSyncStore();
}
