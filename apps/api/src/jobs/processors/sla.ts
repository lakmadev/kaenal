import { withAudit, withTenant } from "@kaenal/db";
import { computeSlaState, ncrMachine, type BusinessHours } from "@kaenal/core";
import type { NcrPriority, NcrStatus, SlaState } from "@kaenal/types";
import type { NotificationsService } from "../../notifications/notifications.service.js";

/**
 * SLA recompute + escalation (06 §1 `sla`). Per tenant, in a tenant-scoped
 * transaction: reclassify every open NCR against its SLA window (using the
 * business-time math in packages/core), and when one has breached, escalate it
 * through `ncrMachine` and notify its owner. Both the state change and the
 * escalation write audit events as a `system` actor. Idempotent: it only writes
 * when the computed state actually differs, so re-running is a no-op.
 */

// The states still "in flight" — terminal (closed/verified) and already-escalated
// NCRs are left alone.
const ACTIVE_STATES: readonly NcrStatus[] = ["draft", "open", "assigned", "in_progress", "resolved", "reopened"];

interface Candidate {
  id: string;
  code: string;
  status: NcrStatus;
  priority: NcrPriority;
  created_at: Date;
  due_at: Date;
  sla_state: SlaState;
  owner_id: string | null;
  tz: string;
}

export interface SlaSweepResult {
  recomputed: number;
  escalated: number;
}

export async function recomputeSlaStatesForTenant(
  tenantId: string,
  now: Date,
  deps: { notifications: NotificationsService },
): Promise<SlaSweepResult> {
  return withTenant(tenantId, null, async (tx) => {
    const businessHours = await loadBusinessHours(tx);

    const { rows } = await tx.query<Candidate>(
      `SELECT n.id, n.code, n.status, n.priority, n.created_at, n.due_at, n.sla_state, n.owner_id,
              COALESCE(p.timezone, 'UTC') AS tz
         FROM ncrs n LEFT JOIN plants p ON p.id = n.plant_id
        WHERE n.due_at IS NOT NULL AND n.deleted_at IS NULL
          AND n.status = ANY($1::text[])`,
      [ACTIVE_STATES],
    );

    let recomputed = 0;
    let escalated = 0;

    for (const ncr of rows) {
      const bh = businessHours[ncr.priority];
      if (bh === undefined) continue; // no SLA ladder for this priority

      const state = computeSlaState(now, ncr.created_at, ncr.due_at, bh, ncr.tz);

      const canEscalate =
        state === "breached" && ncrMachine.canTransition(ncr.status, "escalated", escalationCtx()).ok;

      if (canEscalate) {
        await withAudit(
          tx,
          tenantId,
          {
            actorId: null,
            actorKind: "system",
            entityKind: "ncr",
            entityId: ncr.id,
            action: "status_changed",
            before: { status: ncr.status, slaState: ncr.sla_state },
            after: { status: "escalated", slaState: "breached" },
          },
          (t) => t.query("UPDATE ncrs SET status = 'escalated', sla_state = 'breached' WHERE id = $1", [ncr.id]),
        );
        recomputed += 1;
        escalated += 1;

        if (ncr.owner_id !== null) {
          await deps.notifications.notify(tx, tenantId, {
            userId: ncr.owner_id,
            kind: "ncr_escalated",
            title: `NCR ${ncr.code} escalated — SLA breached`,
            entityKind: "ncr",
            entityId: ncr.id,
            dedupeKey: `sla-escalated:${ncr.id}`,
          });
        }
      } else if (state !== ncr.sla_state) {
        await withAudit(
          tx,
          tenantId,
          {
            actorId: null,
            actorKind: "system",
            entityKind: "ncr",
            entityId: ncr.id,
            action: "updated",
            before: { slaState: ncr.sla_state },
            after: { slaState: state },
          },
          (t) => t.query("UPDATE ncrs SET sla_state = $2 WHERE id = $1", [ncr.id, state]),
        );
        recomputed += 1;
      }
    }

    return { recomputed, escalated };
  });
}

/** Escalation has no state-machine guard, so the ctx is a formality. */
function escalationCtx() {
  return { actions: [], actorId: "system", actorRole: "admin" as const, resolvedBy: null, openEightDId: null };
}

async function loadBusinessHours(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
): Promise<Partial<Record<NcrPriority, BusinessHours>>> {
  const { rows } = await tx.query<{ priority: string; business_hours: BusinessHours }>(
    "SELECT priority, business_hours FROM sla_configs WHERE entity_kind = 'ncr'",
  );
  const out: Partial<Record<NcrPriority, BusinessHours>> = {};
  for (const row of rows) out[row.priority as NcrPriority] = row.business_hours;
  return out;
}
