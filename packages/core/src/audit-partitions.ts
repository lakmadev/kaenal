/**
 * Audit-events partition arithmetic (07 §1, 06 §1 `housekeeping` →
 * `auditEventPartitionRoll`). `audit_events` is range-partitioned by month; the
 * nightly roll job provisions upcoming partitions ahead of time and verifies
 * each partition's row count only ever grows. The pure calendar + comparison
 * logic lives here so it is unit-testable without a database; the processor does
 * the DDL and counting.
 *
 * All months are UTC calendar months, matching how Postgres ranges the
 * `created_at` timestamps.
 */

/** Table-name prefix for a monthly partition. */
export const AUDIT_PARTITION_PREFIX = "audit_events_";

/** First instant of `date`'s UTC month. */
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** First instant of the month after `monthStart(date)`. */
export function nextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** The partition table name for the month containing `date`, e.g. `audit_events_2026_07`. */
export function auditPartitionName(date: Date): string {
  const start = monthStart(date);
  const yyyy = start.getUTCFullYear().toString().padStart(4, "0");
  const mm = (start.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${AUDIT_PARTITION_PREFIX}${yyyy}_${mm}`;
}

/** Half-open `[from, to)` range bounds (ISO) for the month containing `date`. */
export function auditPartitionRange(date: Date): { from: string; to: string } {
  const start = monthStart(date);
  return { from: start.toISOString(), to: nextMonth(start).toISOString() };
}

/**
 * The months that must have a partition NOW: the current month and the next
 * one. Provisioning next month ahead of time keeps the default partition empty,
 * so a month boundary never lands a row in the default (and a new partition can
 * always be created without colliding with default rows).
 */
export function upcomingPartitionMonths(now: Date): Date[] {
  const current = monthStart(now);
  return [current, nextMonth(current)];
}

/**
 * A shrink is the tamper signal: an append-only partition's count can only grow,
 * so a current count below the recorded high-water mark means rows were deleted
 * out from under the trail (07 §1).
 */
export function isTampered(previousCount: number, currentCount: number): boolean {
  return currentCount < previousCount;
}

/** The high-water count to store — never lowered, so a shrink stays detectable. */
export function highWater(previousCount: number, currentCount: number): number {
  return Math.max(previousCount, currentCount);
}
