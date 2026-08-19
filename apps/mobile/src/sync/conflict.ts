// Conflict resolution (05 §2.3) — "this is where offline apps die", so it is a
// pure, fully-tested reducer. The SERVER owns field-level merge and last-write-wins
// (it can see before/after); the CLIENT's job is to react correctly to the
// responses it can actually receive, and to NEVER silently drop a rejected write.

import type { ConflictDecision, FieldClass, MutationRecord, PushOutcome } from "./types.js";

/** Backoff schedule for transient failures: 2^attempts seconds, capped at 5 min. */
export function computeBackoffMs(attempts: number): number {
  const secs = Math.min(2 ** Math.max(0, attempts), 300);
  return secs * 1000;
}

/**
 * Derive the field class from a mutation kind (`entityType.verb`). Drives the
 * per-class policy below. Unknown verbs fall back to free_text (safest: LWW).
 */
export function fieldClassOf(kind: string): FieldClass {
  const verb = kind.split(".")[1] ?? kind;
  if (verb === "create") return "create";
  if (verb === "answer" || verb === "score" || verb === "respond") return "inspection_response";
  if (verb === "start" || verb === "complete" || verb === "transition" || verb === "verify" || verb === "assign")
    return "status_transition";
  return "free_text";
}

/**
 * Decide what happens to a mutation given the normalised push outcome. Pure:
 * (mutation, outcome) → decision. The engine applies the decision (writes status,
 * schedules backoff, or surfaces "needs review"); it never invents behaviour here.
 */
export function resolveConflict(mutation: MutationRecord, outcome: PushOutcome): ConflictDecision {
  switch (outcome.kind) {
    case "ok":
      return { action: "done", serverUpdatedAt: outcome.serverUpdatedAt, serverVersion: outcome.serverVersion };

    case "transient":
      // Offline / 5xx / timeout — safe to replay (Idempotency-Key protects creates).
      return { action: "retry" };

    case "auth":
      // Token expired or access lost. Do NOT fail the item or wipe data — pause the
      // queue and keep local data read-only until re-auth (05 §4).
      return { action: "pause", reason: "Signed-out or session expired — sync paused until you sign in." };

    case "stale_write": {
      // The row moved on since we last saw it. The server already applied any safe
      // field-level merge; a STALE_WRITE means it could not, so preserve local and
      // ask the user. Message is class-specific.
      const cls = fieldClassOf(mutation.kind);
      const reason =
        cls === "inspection_response"
          ? "This inspection changed on the server. Your answers are saved on device for review."
          : cls === "status_transition"
            ? "The status changed on the server while you were offline."
            : "This record changed on the server. Your edit is saved on device for review.";
      return { action: "needs_review", reason };
    }

    case "conflict_transition":
      return {
        action: "needs_review",
        reason: outcome.message ?? "This record was updated by someone else while you were offline.",
      };

    case "not_found":
      // Entity removed, or belongs to another tenant (server returns 404, never 403,
      // to avoid leaking cross-tenant existence — 08 rule #8). Treat as removed.
      return { action: "needs_review", reason: "This record no longer exists on the server." };

    case "validation":
      // Bad payload — a blind retry fails identically, so it is a hard failure the
      // user must act on (retry after edit / discard / convert to comment).
      return { action: "failed", reason: outcome.message };
  }
}
