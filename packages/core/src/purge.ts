/**
 * Soft-delete retention + legal-hold scoping (06 §1 `housekeeping`, 07 §5).
 *
 * A soft delete (`deleted_at`) is the only user-facing delete; the nightly
 * `purgeSoftDeleted` job is what eventually turns it into a permanent one, once
 * the row has sat deleted for the retention window AND no legal hold protects
 * it. The retention arithmetic and the "does this hold cover this row" decision
 * are the pure, testable parts and live here; the job just queries, checks, and
 * deletes.
 */

/** Rows soft-deleted longer ago than this are eligible for permanent purge (06 §1: >90 days). */
export const PURGE_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The cutoff instant: a row is purge-eligible only if `deleted_at` is strictly
 * before this. Everything soft-deleted within the last {@link PURGE_RETENTION_DAYS}
 * days is still recoverable and must survive.
 */
export function purgeCutoff(now: Date, retentionDays: number = PURGE_RETENTION_DAYS): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

/**
 * A legal hold's `scope` (07 §5: `legal_holds.scope jsonb`). While a hold is
 * active it blocks the hard delete of the data it covers. The shape is
 * deliberately small — three progressively narrower forms:
 *
 * - `{}` (no keys) — tenant-wide: blocks the purge of every row in the tenant.
 * - `{ entityKinds: [...] }` — blocks whole entity kinds (e.g. all `ncr` rows).
 * - `{ entityKind, entityId? }` — blocks one kind, or one specific row of it.
 *
 * `entityKind` values are the singular kinds used across the audit trail
 * (`ncr`, `inspection`, `document`, …), not table names.
 */
export interface LegalHoldScope {
  readonly entityKind?: string;
  readonly entityId?: string;
  readonly entityKinds?: readonly string[];
}

/** A row a purge is considering deleting. */
export interface PurgeCandidate {
  readonly entityKind: string;
  readonly entityId: string;
}

/**
 * A tenant-wide hold carries no targeting keys, so it blocks everything. An
 * unrecognised/empty scope is treated as tenant-wide on purpose: the safe
 * failure for "we couldn't tell what this hold covers" is to protect the data,
 * never to purge it.
 */
export function isTenantWideScope(scope: LegalHoldScope): boolean {
  const hasKinds = Array.isArray(scope.entityKinds) && scope.entityKinds.length > 0;
  return !hasKinds && (scope.entityKind === undefined || scope.entityKind === "");
}

/** Does one hold's scope cover this candidate row? */
export function holdBlocks(scope: LegalHoldScope, candidate: PurgeCandidate): boolean {
  if (isTenantWideScope(scope)) return true;
  if (scope.entityKinds?.includes(candidate.entityKind)) return true;
  if (scope.entityKind !== undefined && scope.entityKind === candidate.entityKind) {
    // A kind-only hold covers every row of the kind; a kind+id hold, just the one.
    return scope.entityId === undefined || scope.entityId === candidate.entityId;
  }
  return false;
}

/** Is this candidate protected by ANY of the tenant's active holds? */
export function isBlockedByHolds(
  scopes: readonly LegalHoldScope[],
  candidate: PurgeCandidate,
): boolean {
  return scopes.some((scope) => holdBlocks(scope, candidate));
}

/** Any tenant-wide hold present short-circuits the whole purge. */
export function hasTenantWideHold(scopes: readonly LegalHoldScope[]): boolean {
  return scopes.some(isTenantWideScope);
}
