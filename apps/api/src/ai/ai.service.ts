import type pg from "pg";
import { withAudit, type Tx } from "@kaenal/db";
import type {
  AcceptAiSummaryBody,
  AiDraftDto,
  AiDraftRequest,
  AiSummaryDto,
} from "@kaenal/types";
import { ApiError } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import type { AiGatewayService } from "./gateway.service.js";

/**
 * AI HTTP surface (06 §3). Two operations on top of the governed gateway:
 *
 *  - `draft` runs the gateway and returns the {@link AiDraftDto} (value +
 *    provenance) or maps a governance refusal / provider failure to an HTTP
 *    error. AI never writes an entity here — it only returns a draft.
 *  - `acceptSummary` is the acceptance half (06 §3.6): a normal, audited mutation
 *    that writes the user-reviewed summary onto a document's AI-owned `ai_summary`
 *    field with an `ai_draft_accepted` event. It verifies the draft actually came
 *    from a real succeeded invocation, and uses optimistic concurrency so it
 *    can't clobber a concurrent edit.
 *
 * The gateway manages its own short transactions (a provider call must not pin a
 * request's connection), so `draft` takes no `tx`; `acceptSummary` is a plain
 * entity mutation and runs in the request's tenant transaction.
 */
export class AiService {
  constructor(private readonly gateway: AiGatewayService) {}

  async draft(
    tenantId: string,
    userId: string,
    body: AiDraftRequest,
    pool?: pg.Pool,
  ): Promise<AiDraftDto> {
    const result = await this.gateway.run({
      tenantId,
      userId,
      feature: body.feature,
      input: body.input,
      ...(body.entityRefs !== undefined ? { entityRefs: body.entityRefs } : {}),
      ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
      // Route the gateway's own transactions to this tenant's DB (Model B).
      ...(pool !== undefined ? { pool } : {}),
    });

    if (result.status === "succeeded") {
      return {
        invocationId: result.invocationId,
        value: result.draft.value,
        confidence: result.draft.confidence,
        sources: result.draft.sources.map((s) => ({
          kind: s.kind,
          id: s.id,
          ...(s.quote !== undefined ? { quote: s.quote } : {}),
        })),
      };
    }

    if (result.status === "failed") {
      // 06 §4: a model failure is a soft 503; the manual workflow is never blocked.
      throw new ApiError("AI_UNAVAILABLE", "AI is temporarily unavailable — please try again");
    }

    // Governance refusal — surfaced as the reason the UI should explain (06 §3.1–3.3).
    switch (result.reason) {
      case "entitlement":
        throw new ApiError("ENTITLEMENT_REQUIRED", "The intelligence pack is required for AI features");
      case "budget":
        throw new ApiError("ENTITLEMENT_REQUIRED", "AI credits are exhausted for this period");
      case "ai_disabled":
        throw new ApiError("FORBIDDEN", "AI is disabled for this workspace");
      case "region":
        throw new ApiError("FORBIDDEN", "AI is not available in this workspace's region");
    }
  }

  async acceptSummary(
    tx: Tx,
    tenantId: string,
    userId: string,
    body: AcceptAiSummaryBody,
    ctx: AuditContext,
  ): Promise<AiSummaryDto> {
    // The value must trace back to a real, succeeded invocation in this tenant
    // (RLS scopes the read) — you cannot "accept" a fabricated draft id.
    const inv = await tx.query("SELECT 1 FROM ai_invocations WHERE id = $1 AND status = 'succeeded'", [
      body.invocationId,
    ]);
    if (inv.rowCount === 0) throw new ApiError("NOT_FOUND", "No such AI draft");

    const doc = await tx.query<{ ai_summary: string | null }>(
      "SELECT ai_summary FROM documents WHERE id = $1 AND deleted_at IS NULL",
      [body.documentId],
    );
    if (doc.rows[0] === undefined) throw new ApiError("NOT_FOUND", "No such document");
    const before = doc.rows[0].ai_summary;

    let lockVersion = 0;
    await withAudit(
      tx,
      tenantId,
      {
        actorId: userId,
        actorKind: "user",
        entityKind: "document",
        entityId: body.documentId,
        action: "ai_draft_accepted",
        before: { aiSummary: before },
        after: { aiSummary: body.value, aiInvocationId: body.invocationId },
        requestId: ctx.requestId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      async (t) => {
        const r = await t.query<{ lock_version: number }>(
          `UPDATE documents SET ai_summary = $2, updated_by = $3
            WHERE id = $1 AND lock_version = $4
            RETURNING lock_version`,
          [body.documentId, body.value, userId, body.version],
        );
        // 0 rows = the version moved since the client read it. Throwing here
        // rolls back before the audit event is written (no phantom acceptance).
        if (r.rows[0] === undefined) {
          throw new ApiError("STALE_WRITE", "The document changed since you loaded it — refetch and retry");
        }
        lockVersion = r.rows[0].lock_version;
      },
    );

    return { documentId: body.documentId, aiSummary: body.value, lockVersion };
  }
}
