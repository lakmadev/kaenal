import { withoutTenant } from "@kaenal/db";
import {
  auditPartitionName,
  auditPartitionRange,
  upcomingPartitionMonths,
  isTampered,
  highWater,
} from "@kaenal/core";

/**
 * Audit-events partition roll (06 §1 `housekeeping`, 07 §1). A GLOBAL nightly
 * job — not per-tenant — with two duties:
 *
 *  1. **Provision ahead.** Ensure the current and next month's partitions exist,
 *     so an audit write never lands in (or fails for want of) a partition and the
 *     default stays empty.
 *  2. **Tamper check.** `audit_events` is append-only, so each partition's row
 *     count can only grow; a count below the recorded high-water mark means rows
 *     were deleted out from under the trail — the tampering signal (07 §1).
 *
 * Runs on the owner connection (`withoutTenant`), because it does DDL and counts
 * rows across every tenant: the partition children carry no RLS of their own (the
 * parent's policy governs the app path), so the owner can count them directly.
 */
export interface AuditPartitionRollResult {
  /** Partitions created this run (empty once provisioning has caught up). */
  readonly created: string[];
  /** Partitions whose counts were verified. */
  readonly checked: number;
  /** Partitions whose row count shrank since last check — a tampering signal. */
  readonly tampered: string[];
}

// Names are derived from a Date, never user input, but validated before being
// interpolated into DDL (partition names/bounds cannot be bind parameters).
const PARTITION_NAME_RE = /^audit_events_\d{4}_\d{2}$/;

export async function rollAuditPartitions(
  deps: { now?: Date } = {},
): Promise<AuditPartitionRollResult> {
  const now = deps.now ?? new Date();
  const created: string[] = [];

  // 1. Provision the current + next month partitions.
  for (const month of upcomingPartitionMonths(now)) {
    const name = auditPartitionName(month);
    if (!PARTITION_NAME_RE.test(name)) throw new Error(`refusing to create malformed partition '${name}'`);
    const { from, to } = auditPartitionRange(month);

    const wasCreated = await withoutTenant(async (tx) => {
      const { rows } = await tx.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [name]);
      if (rows[0]?.exists === true) return false;
      await tx.query(
        `CREATE TABLE ${name} PARTITION OF audit_events FOR VALUES FROM ('${from}') TO ('${to}')`,
      );
      return true;
    });
    if (wasCreated) created.push(name);
  }

  // 2. Verify per-partition counts only grow.
  const tampered: string[] = [];
  const checked = await withoutTenant(async (tx) => {
    const { rows: parts } = await tx.query<{ name: string }>(
      `SELECT c.relname AS name
         FROM pg_inherits i
         JOIN pg_class c ON c.oid = i.inhrelid
         JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'audit_events' AND c.relname <> 'audit_events_default'
        ORDER BY c.relname`,
    );

    for (const { name } of parts) {
      if (!PARTITION_NAME_RE.test(name)) continue; // ignore anything unexpected
      const { rows: cnt } = await tx.query<{ n: string }>(`SELECT count(*)::bigint AS n FROM ${name}`);
      const current = Number(cnt[0]!.n);

      const { rows: prev } = await tx.query<{ row_count: string }>(
        "SELECT row_count FROM control.audit_partition_stats WHERE partition_name = $1",
        [name],
      );
      const previous = prev[0] === undefined ? 0 : Number(prev[0].row_count);
      const tamper = isTampered(previous, current);
      if (tamper) tampered.push(name);

      await tx.query(
        `INSERT INTO control.audit_partition_stats (partition_name, row_count, tamper_seen_at, checked_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (partition_name) DO UPDATE
           SET row_count = $2,
               tamper_seen_at = COALESCE(control.audit_partition_stats.tamper_seen_at, EXCLUDED.tamper_seen_at),
               checked_at = now()`,
        [name, highWater(previous, current), tamper ? new Date() : null],
      );
    }
    return parts.length;
  });

  if (tampered.length > 0) {
    // A shrink on an append-only table must be loud — production wires this to
    // an alert/page (07 §1). The stored high-water mark is deliberately not
    // lowered, so the signal persists across runs.
    console.error(`AUDIT TAMPER SIGNAL: partitions shrank since last check: ${tampered.join(", ")}`);
  }

  return { created, checked, tampered };
}
