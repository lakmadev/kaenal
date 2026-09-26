import { randomUUID } from "node:crypto";
import type pg from "pg";
import { withAudit, type Tx } from "@kaenal/db";
import { authorize, authorizePlant, type Capability, type Membership } from "@kaenal/core";
import type { AiChatChunk, AiChatRequest, EntityKind } from "@kaenal/types";
import { notFound } from "../errors.js";
import type { AuditContext } from "../ncr/audit-context.js";
import type { AiGatewayService } from "./gateway.service.js";

/**
 * AI assistant chat (S1-4). READ-ONLY by construction: this file issues one
 * SELECT (entity context, under RLS) and one audit insert; it never writes a
 * business row. The reply is a draft — "Pin to entity" is a separate, capability
 * checked comment mutation the client performs.
 */

interface EntitySpec {
  readonly table: string;
  /** Fixed column names only — never request input. */
  readonly label: string;
  readonly plantScoped: boolean;
  readonly view: Capability;
}

const ENTITY_SPECS: Readonly<Record<EntityKind, EntitySpec>> = {
  inspection: { table: "inspections", label: "title", plantScoped: true, view: "inspection:view" },
  ncr: { table: "ncrs", label: "title", plantScoped: true, view: "ncr:view" },
  eight_d: { table: "eight_ds", label: "title", plantScoped: false, view: "capa:view" },
  audit: { table: "audits", label: "title", plantScoped: true, view: "audit:view" },
  capa: { table: "capas", label: "title", plantScoped: false, view: "capa:view" },
  document: { table: "documents", label: "title", plantScoped: false, view: "document:view" },
  supplier: { table: "suppliers", label: "name", plantScoped: false, view: "supplier:view" },
  scar: { table: "scars", label: "code", plantScoped: false, view: "scar:view" },
};

export interface PreparedChat {
  readonly requestId: string;
  readonly input: string;
  readonly entityRefs: readonly { kind: string; id: string }[];
}

/**
 * Resolve the entity ref under the request's RLS transaction and write the
 * `ai_chat` audit event in the same transaction. A foreign-tenant / unknown /
 * out-of-plant / not-viewable entity is a 404, never a 403 (rule 8).
 */
export async function prepareChat(
  tx: Tx,
  tenantId: string,
  membership: Membership,
  userId: string,
  body: AiChatRequest,
  ctx: AuditContext,
): Promise<PreparedChat> {
  let contextBlock = "";
  const refs: { kind: string; id: string }[] = [];

  if (body.entityRef !== undefined) {
    const spec = ENTITY_SPECS[body.entityRef.kind];
    if (!authorize(membership, spec.view).ok) throw notFound();
    const cols = spec.plantScoped
      ? `code, ${spec.label} AS label, status, plant_id`
      : `code, ${spec.label} AS label, status`;
    const { rows } = await tx.query<{
      code: string | null;
      label: string | null;
      status: string | null;
      plant_id?: string | null;
    }>(`SELECT ${cols} FROM ${spec.table} WHERE id = $1 AND deleted_at IS NULL`, [body.entityRef.id]);
    const row = rows[0];
    if (row === undefined) throw notFound();
    if (spec.plantScoped && !authorizePlant(membership, row.plant_id ?? null).ok) throw notFound();
    refs.push({ kind: body.entityRef.kind, id: body.entityRef.id });
    contextBlock = `CONTEXT (${body.entityRef.kind}): code=${row.code ?? ""}; title=${row.label ?? ""}; status=${row.status ?? ""}\n\n`;
  }

  const history = (body.history ?? []).map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n");
  const input = `${contextBlock}${history === "" ? "" : `${history}\n\n`}QUESTION:\n${body.message}`;

  const requestId = ctx.requestId ?? randomUUID();

  await withAudit(
    tx,
    tenantId,
    {
      actorId: userId,
      actorKind: "user",
      entityKind: body.entityRef?.kind ?? "ai_chat",
      entityId: body.entityRef?.id ?? requestId,
      action: "ai_chat",
      after: { messageChars: body.message.length, entityRef: body.entityRef ?? null },
      requestId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    () => Promise.resolve(),
  );

  return { requestId, input, entityRefs: refs };
}

const CHUNK_PARTS = 8;

/**
 * Run the turn through the governed gateway (redaction, budget, ledger) with NO
 * transaction held, then stream the completed reply as deterministic chunks.
 * Governance refusals and provider failures become an `error` frame — never a
 * fabricated reply. (The provider port is non-streaming today; chunking is
 * server-side.)
 */
export async function* streamChat(
  gateway: AiGatewayService,
  tenantId: string,
  userId: string,
  prepared: PreparedChat,
  pool?: pg.Pool,
): AsyncGenerator<AiChatChunk, void, undefined> {
  const result = await gateway.run({
    tenantId,
    userId,
    feature: "chat",
    input: prepared.input,
    entityRefs: prepared.entityRefs,
    ...(pool !== undefined ? { pool } : {}),
  });
  const requestId = prepared.requestId;

  if (result.status === "blocked") {
    const map = {
      entitlement: ["ENTITLEMENT_REQUIRED", "The intelligence pack is required for AI features"],
      budget: ["BUDGET_EXCEEDED", "AI credits are exhausted for this period"],
      ai_disabled: ["AI_DISABLED", "AI is disabled for this workspace"],
      region: ["REGION_LOCKED", "AI is not available in this workspace's region"],
    } as const;
    const [code, message] = map[result.reason];
    yield { type: "error", code, message, requestId };
    return;
  }
  if (result.status === "failed") {
    yield {
      type: "error",
      code: "AI_UNAVAILABLE",
      message: "AI is temporarily unavailable - please try again",
      requestId,
    };
    return;
  }

  const parts = result.draft.value.split(/(\s+)/);
  for (let i = 0; i < parts.length; i += CHUNK_PARTS) {
    yield { type: "delta", text: parts.slice(i, i + CHUNK_PARTS).join("") };
  }
  yield {
    type: "done",
    invocationId: result.invocationId,
    requestId,
    confidence: gateway.providerName === "stub" ? "low" : result.draft.confidence,
    sources: result.draft.sources.map((s) => ({ kind: s.kind, id: s.id })),
    provider: gateway.providerName,
  };
}
