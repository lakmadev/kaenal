import type { CapaActionDto, CapaActionStatus, EightDDto, EightDStepStatus } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { engine, pushDispatch, uuidv7 } from "@/sync";

/**
 * 8D + CAPA writes on the offline engine (05 §M9). Advancing an owned 8D step and
 * checking off a CAPA action are durable, idempotent mutations so they work
 * offline and reconcile on reconnect. The mutation id is the Idempotency-Key and
 * the last-seen `lockVersion` is the optimistic-concurrency token.
 */

pushDispatch["capa.action.status"] = async (mutation) => {
  const p = mutation.payload as { status: CapaActionStatus };
  const res = await apiClient.updateCapaActionStatus({
    params: { id: mutation.entityId },
    body: { status: p.status, version: mutation.baseVersion ?? 0 },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

pushDispatch["eightd.step"] = async (mutation) => {
  const p = mutation.payload as { step: number; status: EightDStepStatus };
  const res = await apiClient.updateEightDStep({
    params: { id: mutation.entityId, step: p.step },
    body: { status: p.status, version: mutation.baseVersion ?? 0 },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

/** Check a CAPA action off (or move it) — durable. */
export async function enqueueCapaActionStatus(action: CapaActionDto, status: CapaActionStatus): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "capa.action.status",
    entityType: "capa_action",
    entityId: action.id,
    payload: { status },
    baseUpdatedAt: action.updatedAt,
    baseVersion: action.lockVersion,
    dependsOnFileIds: [],
  });
}

/** Advance an owned 8D discipline step — durable. */
export async function enqueueEightDStep(eightd: EightDDto, step: number, status: EightDStepStatus): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "eightd.step",
    entityType: "eight_d",
    entityId: eightd.id,
    payload: { step, status },
    baseUpdatedAt: eightd.updatedAt,
    baseVersion: eightd.lockVersion,
    dependsOnFileIds: [],
  });
}
