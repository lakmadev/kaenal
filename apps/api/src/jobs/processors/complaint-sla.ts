import type pg from "pg";
import { withTenant } from "@kaenal/db";
import { complaintSlaState } from "@kaenal/core";
import type { SlaState } from "@kaenal/types";
import type { NotificationsService } from "../../notifications/notifications.service.js";

/**
 * Complaint SLA check (SPRINT-06 §0 B7a/§3.1, X1 AC7) — rides the EXISTING
 * `sla.sweep` job's per-tenant `recomputeSla` cadence (`SLA_SWEEP_CRON`,
 * every 5 minutes), never a new daily job: a once-daily check cannot serve a
 * 1h/4h acknowledge target.
 *
 * Unlike NCR's `sla_state`, a complaint's SLA state is never stored — it is
 * computed on every read (`complaintSlaState`, `packages/core`). This sweep
 * therefore cannot detect "the state changed" by diffing a stored column; it
 * simply recomputes the CURRENT state on every pass and notifies the
 * complaint's owner whenever that state is `at_risk` or `breached`, deduped
 * by a key that embeds the state itself (`complaint-sla:<id>:<state>`) — the
 * same cycle-tied dedupe shape as Sprint 05's calibration-due fix, so a
 * transition into a NEW state (e.g. at_risk -> breached) gets its own
 * notification rather than being silently swallowed by the first one's dedupe
 * row, while re-running the sweep while still in the SAME state re-notifies
 * no one (the dedupe key doesn't change).
 *
 * A closed complaint's SLA state is frozen (`complaintSlaState`'s own rule,
 * §0 B7b) and excluded from the sweep entirely — there is nothing left to
 * warn about once it's closed.
 */
export async function checkComplaintSlaForTenant(
  tenantId: string,
  deps: { notifications: NotificationsService; now?: Date; pool?: pg.Pool | undefined },
): Promise<{ notified: number }> {
  const now = deps.now ?? new Date();

  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{
      id: string;
      code: string;
      severity: string;
      sla_target_hours: number;
      received_at: Date;
      acknowledged_at: Date | null;
      owner: string;
    }>(
      `SELECT id, code, severity, sla_target_hours, received_at, acknowledged_at, owner
         FROM complaints
        WHERE deleted_at IS NULL AND closed_at IS NULL AND acknowledged_at IS NULL`,
    );

    let notified = 0;
    for (const row of rows) {
      const state: SlaState = complaintSlaState({
        slaTargetHours: row.sla_target_hours,
        receivedAt: row.received_at.toISOString(),
        acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
        closedAt: null,
        now: now.toISOString(),
      });
      if (state !== "at_risk" && state !== "breached") continue;

      const created = await deps.notifications.notify(tx, tenantId, {
        userId: row.owner,
        kind: "complaint_sla_" + state,
        title:
          state === "breached"
            ? `Complaint ${row.code} has breached its response SLA`
            : `Complaint ${row.code} is at risk of breaching its response SLA`,
        entityKind: "complaint",
        entityId: row.id,
        dedupeKey: `complaint-sla:${row.id}:${state}`,
      });
      if (created !== null) notified += 1;
    }

    return { notified };
  }, deps.pool);
}

