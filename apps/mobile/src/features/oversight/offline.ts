import type { DocumentDto } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { engine, pushDispatch, uuidv7 } from "@/sync";

/**
 * Document approvals on the offline engine (05 §M10). Approve/reject is a
 * durable, idempotent mutation carrying the reason (recorded on the audit trail)
 * and the last-seen `version` as the optimistic-concurrency token.
 */

pushDispatch["document.review"] = async (mutation) => {
  const p = mutation.payload as { decision: "approve" | "reject"; reason?: string };
  const res = await apiClient.reviewDocument({
    params: { id: mutation.entityId },
    body: { decision: p.decision, version: mutation.baseVersion ?? 0, reason: p.reason },
    extraHeaders: { "idempotency-key": mutation.id },
  });
  return { status: res.status, body: res.body };
};

export async function enqueueReview(doc: DocumentDto, decision: "approve" | "reject", reason?: string): Promise<void> {
  await engine.enqueue({
    id: uuidv7(),
    kind: "document.review",
    entityType: "document",
    entityId: doc.id,
    payload: { decision, reason },
    baseUpdatedAt: doc.updatedAt,
    baseVersion: doc.lockVersion,
    dependsOnFileIds: [],
  });
}
