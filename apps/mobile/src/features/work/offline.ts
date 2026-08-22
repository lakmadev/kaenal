import type { CapaActionDto, CapaActionStatus, CapaDto, EightDDto, EightDStepStatus } from "@kaenal/types";

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
  const p = mutation.payload as {
    step: number;
    status: EightDStepStatus;
    data?: Record<string, unknown>;
  };
  const res = await apiClient.updateEightDStep({
    params: { id: mutation.entityId, step: p.step },
    body: {
      status: p.status,
      version: mutation.baseVersion ?? 0,
      ...(p.data !== undefined ? { data: p.data } : {}),
    },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

pushDispatch["capa.assign"] = async (mutation) => {
  const p = mutation.payload as { ownerId: string | null };
  const res = await apiClient.assignCapa({
    params: { id: mutation.entityId },
    body: { ownerId: p.ownerId, version: mutation.baseVersion ?? 0 },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

pushDispatch["eightd.assign"] = async (mutation) => {
  const p = mutation.payload as { teamLeadId: string | null };
  const res = await apiClient.assignEightD({
    params: { id: mutation.entityId },
    body: { teamLeadId: p.teamLeadId, version: mutation.baseVersion ?? 0 },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

/** Assign/reassign a CAPA owner — durable. */
export async function enqueueAssignCapa(capa: CapaDto, ownerId: string | null): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "capa.assign",
    entityType: "capa",
    entityId: capa.id,
    payload: { ownerId },
    baseUpdatedAt: capa.updatedAt,
    baseVersion: capa.lockVersion,
    dependsOnFileIds: [],
  });
}

/** Assign/reassign an 8D team lead — durable. */
export async function enqueueAssignEightD(eightd: EightDDto, teamLeadId: string | null): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "eightd.assign",
    entityType: "eight_d",
    entityId: eightd.id,
    payload: { teamLeadId },
    baseUpdatedAt: eightd.updatedAt,
    baseVersion: eightd.lockVersion,
    dependsOnFileIds: [],
  });
}

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
export async function enqueueEightDStep(
  eightd: EightDDto,
  step: number,
  status: EightDStepStatus,
  data?: Record<string, unknown>,
): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "eightd.step",
    entityType: "eight_d",
    entityId: eightd.id,
    payload: { step, status, ...(data !== undefined ? { data } : {}) },
    baseUpdatedAt: eightd.updatedAt,
    baseVersion: eightd.lockVersion,
    dependsOnFileIds: [],
  });
}
