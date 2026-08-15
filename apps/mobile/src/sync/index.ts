// The app's single SyncEngine instance, wired to the real service registry and the
// live sync store. Feature phases register their push handlers into `pushDispatch`
// and their pull pullers into `readPullers`; the engine itself never changes.

import { services } from "../services/index.js";
import { useSync } from "../stores/sync.js";
import { SyncEngine } from "./engine.js";
import { createPusher, type PushCall } from "./pusher.js";
import { createListReadSource, type ListPuller } from "./read-source.js";
import type { SyncSummary } from "./types.js";

/**
 * kind → push handler. Grows one entry per feature phase (inspection.answer in M6,
 * file.attach in M7, ncr.create in M8, …). Empty today — the write path is proven by
 * unit tests; real handlers land with the screens that create the mutations.
 */
export const pushDispatch: Record<string, PushCall> = {};

/** entityType → list puller for the delta-pull fallback. Registered per phase. */
export const readPullers: Record<string, ListPuller> = {};

/** Simple connectivity flag; a NetInfo adapter can drive this in a later phase. */
let online = true;
export function setOnline(next: boolean): void {
  online = next;
  void engine.sync();
}

export const engine = new SyncEngine({
  store: services.syncStore,
  readSource: createListReadSource(readPullers),
  push: createPusher(pushDispatch),
  pullEntities: ["inspection", "ncr"],
  isOnline: () => online,
  onChange: (s) => applyToStore(s),
});

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
