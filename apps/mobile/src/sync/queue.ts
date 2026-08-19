// Mutation-queue reducer (05 §2.2) — pure functions over an array of records, so
// the ordering and blocking rules are unit-tested independently of storage. The
// SQLite adapter persists the array; this module decides what runs next.

import { computeBackoffMs } from "./conflict.js";
import type { MutationRecord, PendingFile } from "./types.js";

/** Group key: FIFO is enforced per entity, parallel across entities. */
export function entityKey(m: Pick<MutationRecord, "entityType" | "entityId">): string {
  return `${m.entityType}:${m.entityId}`;
}

/** Append a new mutation (caller has already assigned id/createdAt/status=pending). */
export function enqueue(queue: MutationRecord[], rec: MutationRecord): MutationRecord[] {
  return [...queue, rec];
}

function filesReady(m: MutationRecord, files: ReadonlyMap<string, PendingFile>): boolean {
  return m.dependsOnFileIds.every((id) => files.get(id)?.status === "uploaded");
}

/**
 * The set of mutations that may push right now. Rules (05 §2.2):
 *  - per entity, only the OLDEST not-done item is a candidate (FIFO);
 *  - a `failed` head blocks ONLY its own entity's queue (others proceed);
 *  - an `inflight` head means that entity is busy — skip it;
 *  - a `pending` head runs only if its backoff gate has elapsed AND every file it
 *    depends on has finished uploading (dependency ordering: files before the
 *    mutation that references them).
 * Result is ordered by createdAt so callers can bound concurrency deterministically.
 */
export function runnableMutations(
  queue: readonly MutationRecord[],
  files: ReadonlyMap<string, PendingFile>,
  now: number = Date.now(),
): MutationRecord[] {
  const heads = new Map<string, MutationRecord>();
  // Oldest not-done item per entity is the head. createdAt then id breaks ties.
  const ordered = [...queue]
    .filter((m) => m.status !== "done")
    .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
  for (const m of ordered) {
    const k = entityKey(m);
    if (!heads.has(k)) heads.set(k, m);
  }

  const out: MutationRecord[] = [];
  for (const head of heads.values()) {
    if (head.status !== "pending") continue; // failed → blocked; inflight → busy
    if (head.nextAttemptAt !== null && now < Date.parse(head.nextAttemptAt)) continue; // backoff
    if (!filesReady(head, files)) continue; // wait for uploads
    out.push(head);
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function replace(queue: readonly MutationRecord[], id: string, patch: Partial<MutationRecord>): MutationRecord[] {
  return queue.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

export function markInflight(queue: readonly MutationRecord[], id: string): MutationRecord[] {
  return replace(queue, id, { status: "inflight" });
}

export function markDone(queue: readonly MutationRecord[], id: string): MutationRecord[] {
  return replace(queue, id, { status: "done", error: null, nextAttemptAt: null });
}

/** Transient failure → back to pending with an incremented backoff gate. */
export function markRetry(
  queue: readonly MutationRecord[],
  id: string,
  now: number = Date.now(),
): MutationRecord[] {
  const cur = queue.find((m) => m.id === id);
  const attempts = (cur?.attempts ?? 0) + 1;
  return replace(queue, id, {
    status: "pending",
    attempts,
    nextAttemptAt: new Date(now + computeBackoffMs(attempts)).toISOString(),
  });
}

/** Hard failure or needs-review — surfaced in the Sync screen, never dropped. */
export function markFailed(queue: readonly MutationRecord[], id: string, reason: string): MutationRecord[] {
  const cur = queue.find((m) => m.id === id);
  return replace(queue, id, { status: "failed", attempts: (cur?.attempts ?? 0) + 1, error: reason, nextAttemptAt: null });
}

/** Remove a done/failed item the user discarded (confirmed) — the only path that drops. */
export function discard(queue: readonly MutationRecord[], id: string): MutationRecord[] {
  return queue.filter((m) => m.id !== id);
}

/** Counts for the sync pill (05 §2.4). */
export function queueCounts(queue: readonly MutationRecord[]): {
  pending: number;
  inflight: number;
  failed: number;
} {
  let pending = 0;
  let inflight = 0;
  let failed = 0;
  for (const m of queue) {
    if (m.status === "pending") pending++;
    else if (m.status === "inflight") inflight++;
    else if (m.status === "failed") failed++;
  }
  return { pending, inflight, failed };
}
