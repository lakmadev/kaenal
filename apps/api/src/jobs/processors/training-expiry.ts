import type pg from "pg";
import { withTenant } from "@kaenal/db";
import { activeCalibrationThreshold, competencyCellState } from "@kaenal/core";
import type { NotificationsService } from "../../notifications/notifications.service.js";
import type { TrainingExpiryJob } from "../job-types.js";

/** `now()` as YYYY-MM-DD in the given IANA timezone. */
function todayIn(tz: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    now,
  );
}

/** YYYY-MM in the given timezone — the gap re-notify cycle bucket (§3.1 item 15). */
function yearMonthIn(tz: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(now);
}

/**
 * Training expiry/gap reminders (Sprint 05 T4 AC1; §3.1 items 6/7/15). For
 * one tenant, per (active, non-partner member) x (non-archived competency)
 * pair, compute the cell state via `competencyCellState` and notify the
 * MEMBER (not an owner — training is about the individual):
 *   - a record with an `expiresAt` in a reminder window (or overdue): the
 *     SAME threshold function calibration uses (`activeCalibrationThreshold`
 *     — the two modules share one algorithm, §3.1 item 15), deduped by the
 *     record's own id + `expiresAt` (a new record from a refresher gets a
 *     fresh key space, B4).
 *   - a `gap` (mandatory, never trained): re-notified once per calendar
 *     month while it persists (no date to key a cycle off).
 * "Today"/"this month" are always the TENANT's own timezone.
 */
export async function trainingExpiryCheckForTenant(
  payload: TrainingExpiryJob,
  deps: { notifications: NotificationsService; now?: Date; pool?: pg.Pool | undefined },
): Promise<{ notified: number }> {
  const now = deps.now ?? new Date();

  return withTenant(
    payload.tenantId,
    null,
    async (tx) => {
      const { rows: tenantRows } = await tx.query<{ timezone: string }>(
        "SELECT timezone FROM control.tenants WHERE id = $1",
        [payload.tenantId],
      );
      const tz = tenantRows[0]?.timezone ?? "UTC";
      const today = todayIn(tz, now);
      const yearMonth = yearMonthIn(tz, now);

      const { rows: members } = await tx.query<{ user_id: string }>(
        "SELECT user_id FROM memberships WHERE status = 'active' AND role <> 'partner' AND deleted_at IS NULL",
      );
      const { rows: competencies } = await tx.query<{ id: string; mandatory: boolean }>(
        "SELECT id, mandatory FROM competencies WHERE archived_at IS NULL AND deleted_at IS NULL",
      );
      if (members.length === 0 || competencies.length === 0) return { notified: 0 };

      const memberIds = members.map((m) => m.user_id);
      const { rows: records } = await tx.query<{
        id: string;
        member_id: string;
        competency_id: string;
        expires_at: string | null;
      }>(
        `SELECT DISTINCT ON (tr.member_id, tr.competency_id)
                tr.id, tr.member_id, tr.competency_id, tr.expires_at::text AS expires_at
           FROM training_records tr
           JOIN competencies c ON c.id = tr.competency_id AND c.archived_at IS NULL AND c.deleted_at IS NULL
          WHERE tr.member_id = ANY($1::uuid[]) AND tr.deleted_at IS NULL
          ORDER BY tr.member_id, tr.competency_id, tr.completed_at DESC, tr.created_at DESC`,
        [memberIds],
      );
      const byPair = new Map<string, { id: string; expires_at: string | null }>();
      for (const r of records) byPair.set(`${r.member_id}:${r.competency_id}`, r);

      let notified = 0;
      for (const memberId of memberIds) {
        for (const c of competencies) {
          const rec = byPair.get(`${memberId}:${c.id}`);
          const state = competencyCellState({
            hasRecord: rec !== undefined,
            mandatory: c.mandatory,
            expiresAt: rec?.expires_at ?? null,
            today,
          });

          if (state === "gap") {
            const created = await deps.notifications.notify(tx, payload.tenantId, {
              userId: memberId,
              kind: "training_gap",
              title: "A mandatory competency has not been completed",
              entityKind: "competency",
              entityId: c.id,
              dedupeKey: `training-expiry:${memberId}:${c.id}:gap:${yearMonth}`,
            });
            if (created !== null) notified += 1;
            continue;
          }
          if ((state === "warn" || state === "overdue") && rec !== undefined && rec.expires_at !== null) {
            const threshold = activeCalibrationThreshold({ nextDue: rec.expires_at, today });
            if (threshold === null) continue;
            const created = await deps.notifications.notify(tx, payload.tenantId, {
              userId: memberId,
              kind: "training_expiring",
              title:
                threshold >= 0
                  ? `A competency expires within ${threshold} days`
                  : `A competency has been expired for ${-threshold}+ days`,
              entityKind: "training_record",
              entityId: rec.id,
              dedupeKey: `training-expiry:${rec.id}:${rec.expires_at}:${threshold}`,
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
