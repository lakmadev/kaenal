import type { CreateNcrBody, NcrDto, NcrTransition } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { engine, pushDispatch, readPullers, uuidv7 } from "@/sync";

/**
 * NCR ↔ offline engine (05 §M8). NCRs mirror through the cursor-list fallback,
 * and create / transition / verify are durable, idempotent mutations so raising
 * or advancing an NCR works offline and shows "saved on device" until it syncs.
 * The mutation id is the Idempotency-Key; transitions/verify carry the last-seen
 * `lockVersion` as the optimistic-concurrency token.
 */

readPullers["ncr"] = async (pageCursor) => {
  const res = await apiClient.listNcrs({ query: pageCursor === null ? {} : { cursor: pageCursor } });
  if (res.status !== 200) return { items: [], nextCursor: null };
  return {
    items: res.body.items.map((n) => ({ id: n.id, updatedAt: n.updatedAt, version: n.lockVersion })),
    nextCursor: res.body.nextCursor,
  };
};

pushDispatch["ncr.create"] = async (mutation) => {
  const { body } = mutation.payload as { body: CreateNcrBody };
  const res = await apiClient.createNcr({ body, extraHeaders: { "idempotency-key": mutation.id } });
  return { status: res.status, body: res.body };
};

pushDispatch["ncr.transition"] = async (mutation) => {
  const p = mutation.payload as { to: NcrTransition; ownerId?: string; reason?: string };
  const res = await apiClient.transitionNcr({
    params: { id: mutation.entityId },
    body: { to: p.to, version: mutation.baseVersion ?? 0, ownerId: p.ownerId, reason: p.reason },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

pushDispatch["ncr.verify"] = async (mutation) => {
  const p = mutation.payload as { reason?: string };
  const res = await apiClient.verifyNcr({
    params: { id: mutation.entityId },
    body: { version: mutation.baseVersion ?? 0, reason: p.reason },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

/** Raise an NCR (durable, offline-safe). Returns the local mutation entity id. */
export async function enqueueCreateNcr(body: CreateNcrBody): Promise<string> {
  const entityId = uuidv7();
  await engine.enqueue({
    id: uuidv7(),
    kind: "ncr.create",
    entityType: "ncr",
    entityId,
    payload: { body },
    baseUpdatedAt: null,
    baseVersion: null,
    dependsOnFileIds: [],
  });
  return entityId;
}

export async function enqueueTransition(
  ncr: NcrDto,
  to: NcrTransition,
  extra?: { ownerId?: string; reason?: string },
): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "ncr.transition",
    entityType: "ncr",
    entityId: ncr.id,
    payload: { to, ...extra },
    baseUpdatedAt: ncr.updatedAt,
    baseVersion: ncr.lockVersion,
    dependsOnFileIds: [],
  });
}

export async function enqueueVerify(ncr: NcrDto, reason?: string): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "ncr.verify",
    entityType: "ncr",
    entityId: ncr.id,
    payload: { reason },
    baseUpdatedAt: ncr.updatedAt,
    baseVersion: ncr.lockVersion,
    dependsOnFileIds: [],
  });
}
