// Default resolution used by tsc (which doesn't do platform-extension resolution)
// and as a fallback. Metro always prefers store.native.ts / store.web.ts over this,
// so the concrete platform pick is made there; this keeps the type surface valid and
// gives Node/test environments a working store.
import { createMemorySyncStore } from "./memory-store.js";
import type { SyncStorePort } from "../ports.js";

export function createSyncStore(): SyncStorePort {
  return createMemorySyncStore();
}
