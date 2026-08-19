// Web resolution of the sync store (Metro picks this for the PWA/preview). Uses the
// in-memory store — offline durability is a device concern, and expo-sqlite's web
// build isn't bundleable here without extra wasm wiring.
import { createMemorySyncStore } from "./memory-store.js";
import type { SyncStorePort } from "../ports.js";

export function createSyncStore(): SyncStorePort {
  return createMemorySyncStore();
}
