// Pure domain types for the offline engine (05 §2). This module imports NOTHING
// platform-specific (no React Native, no expo-sqlite) so the reducers below it
// are unit-testable under plain Vitest and portable to any runtime.

/** Lifecycle of a queued write (05 §2.2). */
export type MutationStatus = "pending" | "inflight" | "failed" | "done";

/**
 * Field class of a mutation — drives conflict policy (05 §2.3). Derived from the
 * mutation `kind`, not stored by the caller.
 */
export type FieldClass = "create" | "inspection_response" | "status_transition" | "free_text";

/**
 * One queued local mutation. `id` is a client-generated uuidv7 and doubles as the
 * `Idempotency-Key` on push, so replays are safe (05 §2.2). Creates carry a
 * client-generated `entityId` (also uuidv7) so an offline-made NCR has a stable id.
 */
export interface MutationRecord {
  id: string;
  kind: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  /** Server `updated_at` the client last saw; null for creates. */
  baseUpdatedAt: string | null;
  /** Optimistic-concurrency `version` the client last saw; null for creates. */
  baseVersion: number | null;
  /** `pending_files` that must finish uploading before this mutation may push. */
  dependsOnFileIds: string[];
  attempts: number;
  status: MutationStatus;
  /** Human-readable reason when `failed` / `needs_review`; never silently dropped. */
  error: string | null;
  createdAt: string;
  /** Backoff gate: not runnable until now >= nextAttemptAt. */
  nextAttemptAt: string | null;
}

/** One server row mirrored locally for offline reads (05 §2). */
export interface MirrorRow {
  id: string;
  entityType: string;
  updatedAt: string;
  version: number;
  /** Tombstone flag — set when the server reports the row deleted. */
  deleted: boolean;
  /** The full DTO as last seen from the server. */
  data: unknown;
}

/** A local photo/file awaiting presign+upload, referenced by a mutation (05 §2.2). */
export interface PendingFile {
  id: string;
  localUri: string;
  mime: string;
  bytes: number;
  sha256: string | null;
  status: "pending" | "uploading" | "uploaded" | "failed";
  /** Server file id once uploaded — what the referencing mutation resolves to. */
  remoteId: string | null;
  error: string | null;
  createdAt: string;
}

/**
 * The result of attempting to push one mutation, normalised from the HTTP
 * response so the conflict reducer (05 §2.3) is pure and testable.
 */
export type PushOutcome =
  | { kind: "ok"; serverUpdatedAt: string; serverVersion: number }
  /** 409 STALE_WRITE — the row moved on since baseUpdatedAt/baseVersion. */
  | { kind: "stale_write" }
  /** Illegal replayed state transition (e.g. NCR already closed). */
  | { kind: "conflict_transition"; message?: string }
  /** 404 — entity gone or belongs to another tenant (never leak: treat as removed). */
  | { kind: "not_found" }
  /** 400/422 — payload rejected; a blind retry will fail identically. */
  | { kind: "validation"; message: string }
  /** 401/403 — token expired or lost access; pause the queue, keep data read-only. */
  | { kind: "auth" }
  /** Offline / 5xx / timeout — transient; retry with backoff. */
  | { kind: "transient" };

/** What the engine should do with a mutation after a push attempt (05 §2.3). */
export type ConflictDecision =
  | { action: "done"; serverUpdatedAt: string; serverVersion: number }
  | { action: "retry" }
  | { action: "needs_review"; reason: string }
  | { action: "failed"; reason: string }
  | { action: "pause"; reason: string };

/** Aggregate sync state surfaced by the persistent pill (05 §2.4). */
export interface SyncSummary {
  online: boolean;
  pending: number;
  failed: number;
  inflight: number;
  needsReview: number;
  lastSyncedAt: string | null;
}
