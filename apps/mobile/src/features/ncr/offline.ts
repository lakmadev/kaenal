import type { CreateNcrBody, NcrDto, NcrTransition } from "@kaenal/types";

import { resolveFileIds } from "@/features/capture/files";
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
  // Evidence ids are staged as LOCAL pending-file ids; the mutation is gated on
  // their upload (dependsOnFileIds), so by now they resolve to server ids.
  const evidenceFileIds =
    body.evidenceFileIds && body.evidenceFileIds.length > 0 ? await resolveFileIds(body.evidenceFileIds) : undefined;
  const res = await apiClient.createNcr({
    body: { ...body, ...(evidenceFileIds ? { evidenceFileIds } : {}) },
    extraHeaders: { "idempotency-key": mutation.id },
  });
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

pushDispatch["ncr.assign"] = async (mutation) => {
  const p = mutation.payload as { ownerId: string | null };
  const res = await apiClient.assignNcr({
    params: { id: mutation.entityId },
    body: { ownerId: p.ownerId, version: mutation.baseVersion ?? 0 },
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

/** Raise an NCR (durable, offline-safe). `body.evidenceFileIds` (if any) are
 *  local pending-file ids; pass them as the upload gate so the create only pushes
 *  once every photo has uploaded (then the dispatch swaps them for server ids). */
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
    dependsOnFileIds: body.evidenceFileIds ?? [],
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

/** Assign, reassign, or clear (ownerId=null) an NCR's owner (durable). */
export async function enqueueAssignNcr(ncr: NcrDto, ownerId: string | null): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "ncr.assign",
    entityType: "ncr",
    entityId: ncr.id,
    payload: { ownerId },
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
