import type pg from "pg";
import { withTenant, withAudit } from "@kaenal/db";
import type { AiGatewayService } from "../../ai/gateway.service.js";
import type { GenerateSummaryJob } from "../job-types.js";

/**
 * Document AI summary (06 §1 `ai`, 06 §3). On demand, draft a summary for a
 * controlled document through the gateway — which enforces entitlement, data
 * controls, budget, and PII redaction, and logs the invocation. The produced
 * summary lands in the document's dedicated `ai_summary` sidecar field.
 *
 * `doc_summary` is the bounded, low-risk first feature (06 §3 phasing): the
 * summary is AI-owned descriptive metadata, not a quality field, so — unlike
 * root-cause / 8D drafting, which return drafts a human must accept — it is
 * persisted directly here, as a `system`-actor `updated` audit event. Idempotent:
 * if the gateway returns the same summary the field already holds, nothing is
 * written and no event is emitted.
 */
export async function generateDocumentSummary(
  payload: GenerateSummaryJob,
  deps: { gateway: AiGatewayService; pool?: pg.Pool | undefined },
): Promise<{ status: "succeeded" | "blocked" | "failed" | "skipped"; invocationId?: string }> {
  const doc = await withTenant(payload.tenantId, payload.userId, async (tx) => {
    const { rows } = await tx.query<{ title: string; category: string; ai_summary: string | null }>(
      `SELECT title, category, ai_summary FROM documents
        WHERE id = $1 AND deleted_at IS NULL`,
      [payload.documentId],
    );
    return rows[0] ?? null;
  }, deps.pool);
  // Missing / foreign-tenant / deleted → nothing to summarise (rule 8: invisible).
  if (doc === null) return { status: "skipped" };

  const result = await deps.gateway.run({
    tenantId: payload.tenantId,
    userId: payload.userId,
    feature: "doc_summary",
    input: `${doc.title}\n(category: ${doc.category})`,
    entityRefs: [{ kind: "document", id: payload.documentId }],
    pool: deps.pool,
  });

  if (result.status !== "succeeded") {
    return { status: result.status, invocationId: result.invocationId };
  }

  const summary = result.draft.value;
  if (summary === doc.ai_summary) {
    // Idempotent re-run: identical summary already stored, no mutation to make.
    return { status: "succeeded", invocationId: result.invocationId };
  }

  await withTenant(payload.tenantId, payload.userId, (tx) =>
    withAudit(
      tx,
      payload.tenantId,
      {
        actorId: null,
        actorKind: "system",
        entityKind: "document",
        entityId: payload.documentId,
        action: "updated",
        before: { aiSummary: doc.ai_summary },
        after: { aiSummary: summary },
      },
      (t) => t.query("UPDATE documents SET ai_summary = $2, updated_at = now() WHERE id = $1", [payload.documentId, summary]),
    ),
    deps.pool,
  );

  return { status: "succeeded", invocationId: result.invocationId };
}
