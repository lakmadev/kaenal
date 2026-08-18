import type { FormResponses, InspectionDto } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { engine, pushDispatch, readPullers, uuidv7 } from "@/sync";

/**
 * Wires inspections into the offline engine (05 §M3 seam). Imported for its side
 * effects once at app start so the registrations exist before the first sync
 * cycle — the engine reads `readPullers`/`pushDispatch` by reference at run time,
 * so late registration is safe.
 *
 *  - READ: mirror inspections through the cursor-list fallback (maps the DTO's
 *    `lockVersion` onto the engine's generic `version`).
 *  - WRITE: `inspection.complete` is a durable, idempotent mutation — completing
 *    offline queues it and shows "saved on device", and it syncs on reconnect
 *    (the design's InspSaved state). The mutation id is the Idempotency-Key and
 *    the last-seen `lockVersion` is the optimistic-concurrency token.
 */

readPullers["inspection"] = async (pageCursor) => {
  const res = await apiClient.listInspections({ query: pageCursor === null ? {} : { cursor: pageCursor } });
  if (res.status !== 200) return { items: [], nextCursor: null };
  return {
    items: res.body.items.map((i) => ({ id: i.id, updatedAt: i.updatedAt, version: i.lockVersion })),
    nextCursor: res.body.nextCursor,
  };
};

pushDispatch["inspection.complete"] = async (mutation) => {
  const { responses } = mutation.payload as { responses: FormResponses };
  const res = await apiClient.completeInspection({
    params: { id: mutation.entityId },
    body: { responses, version: mutation.baseVersion ?? 0 },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

/** Queue a durable, offline-safe completion for `insp` with the given responses. */
export async function enqueueComplete(insp: InspectionDto, responses: FormResponses): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "inspection.complete",
    entityType: "inspection",
    entityId: insp.id,
    payload: { responses },
    baseUpdatedAt: insp.updatedAt,
    baseVersion: insp.lockVersion,
    dependsOnFileIds: [],
  });
}
