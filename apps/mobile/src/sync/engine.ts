// Sync engine (05 §2) — the orchestrator that wires the pure reducers to the
// persistence store, the read source, and the pusher. It owns no policy of its own:
// ordering comes from queue.ts, conflict handling from conflict.ts, cursor math from
// cursor.ts. That separation is what makes the hard parts unit-testable.
//
// Runs: pull (read) → push (write) → pull again, per spec ("after each push"). It is
// re-entrant-safe (a single in-flight guard) so overlapping triggers — app start,
// foreground, manual "sync now", push nudge — collapse into one cycle.

import type { SyncStorePort } from "../services/ports.js";
import { queueCounts, markDone, markFailed, markInflight, markRetry, runnableMutations } from "./queue.js";
import { resolveConflict } from "./conflict.js";
import type { SyncReadSource } from "./read-source.js";
import type { PushFn } from "./pusher.js";
import type { MirrorRow, MutationRecord, PendingFile, SyncSummary } from "./types.js";

export interface EngineDeps {
  store: SyncStorePort;
  readSource: SyncReadSource;
  push: PushFn;
  /** Entity types to delta-pull, in order. */
  pullEntities: string[];
  /** Connectivity probe; the engine skips network work when offline. */
  isOnline: () => boolean;
  /**
   * Upload any queued `pending_files` (presign → PUT → complete) before the push
   * pass, so that mutations gated on `dependsOnFileIds` become runnable once their
   * evidence is on the server (05 §2.2 presign-at-push). Optional/no-op when unset.
   */
  uploadFiles?: () => Promise<void>;
  /** Called after any state change so the UI (sync store / pill) can refresh. */
  onChange?: (summary: SyncSummary) => void;
  /** Wall clock, injectable for deterministic tests. */
  now?: () => number;
  /** Max mutations pushed per cycle (bounds a large backlog). */
  batch?: number;
}

export class SyncEngine {
  private readonly d: EngineDeps;
  private active: Promise<void> | null = null;
  private queuedRerun = false;
  private paused = false;

  constructor(deps: EngineDeps) {
    this.d = { batch: 25, now: () => Date.now(), ...deps };
  }

  /** Re-enable after a pause (e.g. successful re-auth). */
  resume(): void {
    this.paused = false;
  }

  /** Reset a failed / needs-review mutation to pending and kick a cycle (05 §M11). */
  async retryMutation(id: string): Promise<void> {
    const m = (await this.d.store.listMutations()).find((x) => x.id === id);
    if (m === undefined) return;
    await this.d.store.putMutation({ ...m, status: "pending", error: null, attempts: 0, nextAttemptAt: null });
    this.paused = false;
    await this.emit();
    void this.sync();
  }

  /** Drop a queued mutation the user chooses not to keep (05 §M11). Never silent. */
  async discardMutation(id: string): Promise<void> {
    await this.d.store.deleteMutation(id);
    await this.emit();
  }

  async summary(): Promise<SyncSummary> {
    const [q, cursorNcr] = await Promise.all([this.d.store.listMutations(), this.d.store.getCursor("_lastSyncedAt")]);
    const c = queueCounts(q);
    const needsReview = q.filter((m) => m.status === "failed" && m.error?.startsWith("REVIEW:")).length;
    return {
      online: this.d.isOnline(),
      pending: c.pending,
      inflight: c.inflight,
      failed: c.failed - needsReview,
      needsReview,
      lastSyncedAt: cursorNcr,
    };
  }

  private async emit(): Promise<void> {
    this.d.onChange?.(await this.summary());
  }

  /** Persist a new local mutation and kick a cycle. Returns the stored record. */
  async enqueue(
    rec: Omit<MutationRecord, "attempts" | "status" | "error" | "nextAttemptAt" | "createdAt"> &
      Partial<Pick<MutationRecord, "createdAt">>,
  ): Promise<MutationRecord> {
    const full: MutationRecord = {
      attempts: 0,
      status: "pending",
      error: null,
      nextAttemptAt: null,
      createdAt: rec.createdAt ?? new Date(this.d.now!()).toISOString(),
      ...rec,
    };
    await this.d.store.putMutation(full);
    await this.emit();
    void this.sync();
    return full;
  }

  /**
   * Full cycle: pull → push → pull. Collapses concurrent triggers — a call made
   * while a cycle is running requests a rerun and awaits the SAME in-flight promise,
   * so callers can always `await sync()` and know the queue has settled.
   */
  sync(): Promise<void> {
    if (this.active) {
      this.queuedRerun = true;
      return this.active;
    }
    // Wrap in an IIFE so `active` is cleared strictly AFTER the cycle finishes —
    // `run()` itself must not touch `active`, or a synchronous early-return (offline)
    // would clear it before this assignment sets it, wedging the engine.
    const p = (async () => {
      try {
        await this.run();
      } finally {
        this.active = null;
        await this.emit();
      }
    })();
    this.active = p;
    return p;
  }

  private async run(): Promise<void> {
    do {
      this.queuedRerun = false;
      if (!this.d.isOnline() || this.paused) break;
      await this.pull();
      // Upload queued evidence first, so file-dependent mutations can run this pass.
      if (this.d.uploadFiles) await this.d.uploadFiles();
      const pushed = await this.push();
      if (pushed > 0 && this.d.isOnline()) await this.pull();
    } while (this.queuedRerun);
  }

  /** Delta-pull each entity, upsert the mirror, advance the cursor. */
  async pull(): Promise<void> {
    for (const entity of this.d.pullEntities) {
      const since = await this.d.store.getCursor(entity);
      const batch = await this.d.readSource.pull(entity, since);
      if (batch.rows.length > 0) await this.d.store.upsertMirror(batch.rows);
      if (batch.cursor && batch.cursor !== since) await this.d.store.setCursor(entity, batch.cursor);
    }
    await this.d.store.setCursor("_lastSyncedAt", new Date(this.d.now!()).toISOString());
  }

  /** Push runnable mutations; apply each conflict decision. Returns # attempted. */
  async push(): Promise<number> {
    const now = this.d.now!();
    const [queue, files] = await Promise.all([this.d.store.listMutations(), this.d.store.listFiles()]);
    const fileMap = new Map<string, PendingFile>(files.map((f) => [f.id, f]));
    const runnable = runnableMutations(queue, fileMap, now).slice(0, this.d.batch);

    let attempted = 0;
    // Local working copy so multiple mutations in this batch see prior transitions.
    let work = queue;
    for (const m of runnable) {
      work = markInflight(work, m.id);
      await this.d.store.putMutation(work.find((x) => x.id === m.id)!);

      const outcome = await this.d.push(m);
      const decision = resolveConflict(m, outcome);
      attempted++;

      switch (decision.action) {
        case "done": {
          work = markDone(work, m.id);
          await this.d.store.putMutation(work.find((x) => x.id === m.id)!);
          // Reflect the server's authoritative row in the mirror immediately.
          if (decision.serverVersion > 0) {
            const row: MirrorRow = {
              entityType: m.entityType,
              id: m.entityId,
              updatedAt: decision.serverUpdatedAt,
              version: decision.serverVersion,
              deleted: false,
              data: (outcome.kind === "ok" ? (m.payload as unknown) : null) ?? {},
            };
            await this.d.store.upsertMirror([row]);
          }
          // Drop completed writes so the queue stays small.
          await this.d.store.deleteMutation(m.id);
          break;
        }
        case "retry": {
          work = markRetry(work, m.id, now);
          await this.d.store.putMutation(work.find((x) => x.id === m.id)!);
          break;
        }
        case "needs_review": {
          work = markFailed(work, m.id, `REVIEW:${decision.reason}`);
          await this.d.store.putMutation(work.find((x) => x.id === m.id)!);
          break;
        }
        case "failed": {
          work = markFailed(work, m.id, decision.reason);
          await this.d.store.putMutation(work.find((x) => x.id === m.id)!);
          break;
        }
        case "pause": {
          // Roll the item back to pending (no attempt charged) and stop the cycle.
          work = work.map((x) => (x.id === m.id ? { ...x, status: "pending" as const } : x));
          await this.d.store.putMutation(work.find((x) => x.id === m.id)!);
          this.paused = true;
          return attempted;
        }
      }
      await this.emit();
    }
    return attempted;
  }
}
