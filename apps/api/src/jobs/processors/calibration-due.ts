import type pg from "pg";
import { withTenant } from "@kaenal/db";
import { activeCalibrationThreshold } from "@kaenal/core";
import type { NotificationsService } from "../../notifications/notifications.service.js";
import type { CalibrationDueJob } from "../job-types.js";

/** `now()` as YYYY-MM-DD in the given IANA timezone. */
function todayIn(tz: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    now,
  );
}

/**
 * Calibration due/overdue/failed reminders (Sprint 05 C5 AC1; §3.1 items 14/
 * 15). For one tenant, per active instrument:
 *   - if `next_due` has entered a reminder window (30/7/0 days out, or an
 *     escalating 7-day overdue cadence), remind the owner once per
 *     due-date CYCLE (the dedupe key embeds `next_due` itself, since
 *     `notifications_dedupe_uq` is permanent — B4);
 *   - independently, if the newest calibration event is `fail`, remind the
 *     owner on this sweep regardless of `next_due` — deduped by the failing
 *     event's own id, so a later, distinct fail gets its own notification.
 * "Today" is always the instrument's OWN plant timezone (§3.1 item 15), the
 * same rule every calibration read path uses.
 */
export async function calibrationDueCheckForTenant(
  payload: CalibrationDueJob,
  deps: { notifications: NotificationsService; now?: Date; pool?: pg.Pool | undefined },
): Promise<{ notified: number }> {
  const now = deps.now ?? new Date();

  return withTenant(
    payload.tenantId,
    null,
    async (tx) => {
      const { rows } = await tx.query<{
        id: string;
        code: string;
        owner: string | null;
        next_due: string | null;
        last_result: string | null;
        timezone: string;
      }>(
        `SELECT i.id, i.code, i.owner, i.next_due::text AS next_due, i.last_result, p.timezone
           FROM instruments i JOIN plants p ON p.id = i.plant_id
          WHERE i.status = 'active' AND i.deleted_at IS NULL`,
      );

      let notified = 0;
      for (const row of rows) {
        if (row.owner === null) continue; // no one to remind
        const today = todayIn(row.timezone, now);

        if (row.next_due !== null) {
          const threshold = activeCalibrationThreshold({ nextDue: row.next_due, today });
          if (threshold !== null) {
            const created = await deps.notifications.notify(tx, payload.tenantId, {
              userId: row.owner,
              kind: "instrument_calibration_due",
              title:
                threshold >= 0
                  ? `Instrument "${row.code}" is due for calibration within ${threshold} days`
                  : `Instrument "${row.code}" is overdue for calibration by ${-threshold}+ days`,
              entityKind: "instrument",
              entityId: row.id,
              dedupeKey: `cal-due:${row.id}:${row.next_due}:${threshold}`,
            });
            if (created !== null) notified += 1;
          }
        }

        if (row.last_result === "fail") {
          const { rows: newest } = await tx.query<{ id: string }>(
            `SELECT id FROM calibration_events
               WHERE instrument_id = $1 AND deleted_at IS NULL
               ORDER BY performed_at DESC, created_at DESC LIMIT 1`,
            [row.id],
          );
          const eventId = newest[0]?.id;
          if (eventId !== undefined) {
            const created = await deps.notifications.notify(tx, payload.tenantId, {
              userId: row.owner,
              kind: "instrument_calibration_due",
              title: `Instrument "${row.code}" failed its last calibration`,
              entityKind: "instrument",
              entityId: row.id,
              dedupeKey: `cal-fail:${row.id}:${eventId}`,
            });
            if (created !== null) notified += 1;
          }
        }
      }
      return { notified };
    },
    deps.pool,
  );
}
