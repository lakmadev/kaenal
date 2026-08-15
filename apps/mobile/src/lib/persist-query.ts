// TanStack Query persistence (05 §2, "persisted to SQLite for instant cold-start").
// The server cache is written through the KV port (AsyncStorage on device) so a cold
// launch paints last-known data immediately, before the sync engine re-pulls. Kept
// behind the KvPort so the storage backend is swappable like every other service.

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

import { services } from "../services/index.js";

const CACHE_KEY = "kaenal.query-cache";

/** A persister backed by the KV port (not AsyncStorage directly) for portability. */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => services.kv.getItem(k),
    setItem: (k, v) => services.kv.setItem(k, v),
    removeItem: (k) => services.kv.removeItem(k),
  },
  key: CACHE_KEY,
  // Debounce writes so rapid cache churn on the floor doesn't thrash storage.
  throttleTime: 1000,
});

/** Bump when the cache shape changes so stale caches are dropped on upgrade. */
export const PERSIST_BUSTER = "m3-1";
