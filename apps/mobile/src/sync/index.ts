// The app's single SyncEngine instance, wired to the real service registry and the
// live sync store. Feature phases register their push handlers into `pushDispatch`
// and their pull pullers into `readPullers`; the engine itself never changes.

import { apiClient } from "../lib/api.js";
import { uploadPendingFiles } from "../features/capture/files.js";
import { presentLocal } from "../services/notifications.js";
import { services } from "../services/index.js";
import { useSession } from "../stores/session.js";
import { useSync } from "../stores/sync.js";
import { SyncEngine } from "./engine.js";
import { uuidv7 } from "./ids.js";
import { createPusher, type PushCall } from "./pusher.js";
import { createDeltaReadSource, createListReadSource, type DeltaFetcher, type DeltaPage, type ListPuller } from "./read-source.js";
import type { SyncSummary } from "./types.js";

/**
 * kind → push handler. Grows one entry per feature phase (inspection.answer in M6,
 * file.attach in M7, ncr.create in M8, …). Empty today — the write path is proven by
 * unit tests; real handlers land with the screens that create the mutations.
 */
export const pushDispatch: Record<string, PushCall> = {};

/** entityType → list puller — the fallback for entities without a delta endpoint. */
export const readPullers: Record<string, ListPuller> = {};

/**
 * entityType → `/v1/sync/<entity>` delta fetcher (05 §2.1). ncr + inspection have
 * real delta endpoints; each maps the server's `{changed, deleted, nextCursor,
 * hasMore}` onto the engine's generic `Versioned` (DTO `lockVersion` → `version`).
 * An entity absent here transparently falls back to the list read source.
 */
const toVersioned = (i: { id: string; updatedAt: string; lockVersion: number }) => ({
  id: i.id,
  updatedAt: i.updatedAt,
  version: i.lockVersion,
});
const emptyPage: DeltaPage = { changed: [], deleted: [], nextCursor: null, hasMore: false };

export const deltaFetchers: Record<string, DeltaFetcher> = {
  ncr: async (cursor) => {
    const res = await apiClient.syncNcr({ query: cursor === null ? {} : { cursor } });
    if (res.status !== 200) return emptyPage;
    return { changed: res.body.changed.map(toVersioned), deleted: res.body.deleted, nextCursor: res.body.nextCursor, hasMore: res.body.hasMore };
  },
  inspection: async (cursor) => {
    const res = await apiClient.syncInspections({ query: cursor === null ? {} : { cursor } });
    if (res.status !== 200) return emptyPage;
    return { changed: res.body.changed.map(toVersioned), deleted: res.body.deleted, nextCursor: res.body.nextCursor, hasMore: res.body.hasMore };
  },
};

/** Simple connectivity flag; a NetInfo adapter can drive this in a later phase. */
let online = true;
export function setOnline(next: boolean): void {
  online = next;
  void engine.sync();
}

export const engine = new SyncEngine({
  store: services.syncStore,
  // Real delta endpoints for ncr + inspection; the list source stays as the
  // fallback for any entity that doesn't (yet) have a `/v1/sync/*` route.
  readSource: createDeltaReadSource(deltaFetchers, createListReadSource(readPullers)),
  push: createPusher(pushDispatch),
  uploadFiles: uploadPendingFiles,
  pullEntities: ["inspection", "ncr"],
  isOnline: () => online,
  onChange: (s) => {
    applyToStore(s);
    void reportHealth(s);
  },
  // A parked write raises a local "sync failed" alert (05 §3). The entity ref
  // lets the tap deep-link straight to the record that needs attention.
  onNeedsReview: (m, reason) => {
    void presentLocal("Sync needs attention", reason, {
      entityKind: m.entityType,
      entityId: m.entityId,
    });
  },
});

/** Stable per-install id, persisted once — identifies this device's sync health
 *  rows on the server without ever being a credential. */
let deviceIdCache: string | null = null;
async function deviceId(): Promise<string> {
  if (deviceIdCache !== null) return deviceIdCache;
  const KEY = "kaenal.deviceId";
  let id = await services.kv.getItem(KEY);
  if (id === null || id === "") {
    id = uuidv7();
    await services.kv.setItem(KEY, id);
  }
  deviceIdCache = id;
  return id;
}

/**
 * Report this device's sync health to the server (05 §M5) so the admin dashboard
 * "Failed syncs" tile has a real, tenant-wide source. Fires once per quiescent
 * cycle (nothing in flight), only while signed in and online, and is strictly
 * best-effort: a telemetry failure must never park a write or surface to the user.
 */
async function reportHealth(s: SyncSummary): Promise<void> {
  if (!s.online || s.inflight > 0) return;
  if (useSession.getState().token == null) return;
  try {
    await apiClient.reportSyncHealth({
      body: { deviceId: await deviceId(), failed: s.failed, needsReview: s.needsReview, lastSyncedAt: s.lastSyncedAt ?? null },
    });
  } catch {
    // best-effort — swallow.
  }
}

/** Map the engine summary onto the header-pill store shape. */
function applyToStore(s: SyncSummary): void {
  const state = !s.online
    ? "offline"
    : s.failed > 0 || s.needsReview > 0
      ? "failed"
      : s.pending > 0 || s.inflight > 0
        ? "pending"
        : "synced";
  useSync.getState().set({
    state,
    pending: s.pending + s.inflight,
    failed: s.failed + s.needsReview,
    lastSyncedAt: s.lastSyncedAt ? Date.parse(s.lastSyncedAt) : null,
  });
}

/** Initialise the store and run a first cycle. Called once after sign-in. */
export async function startSync(): Promise<void> {
  await services.syncStore.init();
  await engine.sync();
}

export { SyncEngine } from "./engine.js";
export * from "./types.js";
export { uuidv7, isUuidV7 } from "./ids.js";
