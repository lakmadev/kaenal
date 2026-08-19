// The SyncStorePort for the current platform. Resolution happens by file extension:
// Metro loads store.native.ts (expo-sqlite) on iOS/Android and store.web.ts
// (in-memory) on web; tsc/Node use store.ts. Same contract everywhere, so nothing
// downstream branches on platform.
export { createSyncStore } from "./store.js";
export { createMemorySyncStore } from "./memory-store.js";
