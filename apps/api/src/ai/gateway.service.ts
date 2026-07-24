import type pg from "pg";
import { withTenant, type Tx } from "@kaenal/db";
import {
  gateInvocation,
  routeFeature,
  redactPii,
  rehydrate,
  redactionCount,
  INTELLIGENCE_PACK,
  type AiBudget,
  type AiBlockReason,
  type AiDraft,
} from "@kaenal/core";
import type { AiFeature } from "@kaenal/types";
import { featurePrompt } from "./prompts.js";
import type { AiCompletion, AiProvider } from "./provider.js";

/**
 * The AI gateway (06 §3) — the single chokepoint every model call passes
 * through. Responsibilities, in order: entitlement + data-control + budget gate
 * (fail closed), PII redaction pre-flight, versioned prompt assembly, the
 * provider call, and the invocation ledger + budget charge. AI never writes to
 * an entity: it returns an {@link AiDraft} the caller may later accept (that
 * acceptance is a normal audited mutation — a separate slice).
 *
 * The pure decisions live in `@kaenal/core`; this wires them to Postgres and the
 * provider. Crucially the provider call happens OUTSIDE any DB transaction — a
 * short read tx gates, the model runs with no connection held, then a short
 * write tx records the outcome — so model latency never pins a pool connection.
 *
 * The ledger (`ai_invocations`) IS the AI audit trail (06 §3.5 / FEATURES §16.1),
 * so — like notifications — it is written directly, not through `withAudit`:
 * these rows are telemetry, not entity mutations. Every path records exactly one
 * invocation row: a `blocked` refusal, a `failed` provider error, or a
 * `succeeded` call.
 */
export interface AiEntityRef {
  readonly kind: string;
  readonly id: string;
}

export interface AiRunParams {
  readonly tenantId: string;
  readonly userId: string | null;
  readonly feature: AiFeature;
  readonly input: string;
  readonly entityRefs?: readonly AiEntityRef[];
  readonly maxTokens?: number;
  /** Extra literals to mask pre-flight (e.g. names of non-team members). */
  readonly extraRedactionTerms?: readonly string[];
  /**
   * The tenant's database pool (Model B). Undefined = shared default pool. The
   * gateway opens its own short transactions (outside any request tx), so it
   * must route them to the same database a dedicated tenant's data lives in.
   */
  readonly pool?: pg.Pool | undefined;
}

export type AiRunResult =
  | { readonly status: "succeeded"; readonly draft: AiDraft; readonly invocationId: string }
  | { readonly status: "blocked"; readonly reason: AiBlockReason; readonly invocationId: string }
  | { readonly status: "failed"; readonly error: string; readonly invocationId: string };

interface Settings {
  readonly allowAi: boolean;
  readonly allowCrossEntityContext: boolean;
  readonly piiRedaction: boolean;
  readonly regionLock: string | null;
}

const DEFAULT_SETTINGS: Settings = {
  allowAi: true,
  allowCrossEntityContext: false,
  piiRedaction: true,
  regionLock: null,
};

interface RecordOpts {
  readonly status: "succeeded" | "failed" | "blocked";
  readonly blockReason?: AiBlockReason;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly latencyMs?: number;
  readonly redactions?: number;
  readonly error?: string;
}

export class AiGatewayService {
  constructor(private readonly provider: AiProvider) {}

  async run(params: AiRunParams): Promise<AiRunResult> {
    const route = routeFeature(params.feature);
    const maxTokens = params.maxTokens ?? route.defaultMaxTokens;

    // tx1 (short read): load governance state and gate. A refusal is recorded
    // here and returned; nothing reaches the provider.
    const gated = await withTenant(params.tenantId, params.userId, async (tx) => {
      const settings = await this.loadSettings(tx, params.tenantId);
      const packActive = await this.loadPackActive(tx, params.tenantId);
      const budget = await this.loadBudget(tx, params.tenantId);
      const estimatedTokens = estimateTokens(params.input) + maxTokens;

      const decision = gateInvocation({
        packActive,
        allowAi: settings.allowAi,
        regionLock: settings.regionLock,
        providerRegion: this.provider.region,
        budget,
        estimatedTokens,
      });

      if (!decision.ok) {
        const invocationId = await this.record(tx, params, route.model, {
          status: "blocked",
          blockReason: decision.reason,
        });
        return { kind: "blocked" as const, reason: decision.reason, invocationId };
      }
      return { kind: "ok" as const, settings };
    }, params.pool);

    if (gated.kind === "blocked") {
      return { status: "blocked", reason: gated.reason, invocationId: gated.invocationId };
    }

    // Redact + call the provider with NO DB transaction held across the latency.
    const redaction = gated.settings.piiRedaction
      ? redactPii(params.input, params.extraRedactionTerms ? { extraTerms: params.extraRedactionTerms } : {})
      : { redacted: params.input, map: {} as Record<string, string> };
    const prompt = featurePrompt(params.feature);
    const startedAt = Date.now();

    let completion: AiCompletion;
    try {
      completion = await this.provider.complete({
        model: route.model,
        system: prompt.system,
        input: redaction.redacted,
        maxTokens,
      });
    } catch (err) {
      // 06 §4: a model failure never blocks the manual workflow — record it and
      // surface a soft failure the caller can retry or degrade around.
      const latencyMs = Date.now() - startedAt;
      const error = err instanceof Error ? err.message : "provider error";
      const invocationId = await withTenant(
        params.tenantId,
        params.userId,
        (tx) =>
          this.record(tx, params, route.model, {
            status: "failed",
            latencyMs,
            error,
            redactions: redactionCount(redaction.map),
          }),
        params.pool,
      );
      return { status: "failed", error, invocationId };
    }

    const latencyMs = Date.now() - startedAt;
    const value = rehydrate(completion.text, redaction.map);

    // tx2 (short write): record success and charge the period budget.
    const invocationId = await withTenant(params.tenantId, params.userId, async (tx) => {
      const id = await this.record(tx, params, route.model, {
        status: "succeeded",
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        latencyMs,
        redactions: redactionCount(redaction.map),
      });
      await this.chargeBudget(tx, params.tenantId, completion.inputTokens + completion.outputTokens);
      return id;
    }, params.pool);

    const draft: AiDraft = {
      value,
      confidence: "medium",
      sources: (params.entityRefs ?? []).map((r) => ({ kind: r.kind, id: r.id })),
    };
    return { status: "succeeded", draft, invocationId };
  }

  private async loadSettings(tx: Tx, tenantId: string): Promise<Settings> {
    const { rows } = await tx.query<{
      allow_ai: boolean;
      allow_cross_entity_context: boolean;
      pii_redaction: boolean;
      region_lock: string | null;
    }>(
      `SELECT allow_ai, allow_cross_entity_context, pii_redaction, region_lock
         FROM ai_settings WHERE tenant_id = $1`,
      [tenantId],
    );
    const row = rows[0];
    if (row === undefined) return DEFAULT_SETTINGS;
    return {
      allowAi: row.allow_ai,
      allowCrossEntityContext: row.allow_cross_entity_context,
      piiRedaction: row.pii_redaction,
      regionLock: row.region_lock,
    };
  }

  private async loadPackActive(tx: Tx, tenantId: string): Promise<boolean> {
    const { rows } = await tx.query<{ active: boolean }>(
      "SELECT active FROM entitlements WHERE tenant_id = $1 AND pack_id = $2",
      [tenantId, INTELLIGENCE_PACK],
    );
    return rows[0]?.active ?? false;
  }

  private async loadBudget(tx: Tx, tenantId: string): Promise<AiBudget | null> {
    const { rows } = await tx.query<{ token_limit: string; tokens_used: string }>(
      `SELECT token_limit, tokens_used FROM ai_budgets
        WHERE tenant_id = $1 AND period = date_trunc('month', now())::date`,
      [tenantId],
    );
    const row = rows[0];
    if (row === undefined) return null; // no budget configured → unmetered
    return { tokenLimit: Number(row.token_limit), tokensUsed: Number(row.tokens_used) };
  }

  private async chargeBudget(tx: Tx, tenantId: string, spent: number): Promise<void> {
    // No-op when the tenant has no budget row for the period (unmetered).
    await tx.query(
      `UPDATE ai_budgets
          SET tokens_used = tokens_used + $2, updated_at = now()
        WHERE tenant_id = $1 AND period = date_trunc('month', now())::date`,
      [tenantId, spent],
    );
  }

  private async record(tx: Tx, params: AiRunParams, model: string, opts: RecordOpts): Promise<string> {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO ai_invocations
         (tenant_id, user_id, feature, model, status, block_reason,
          input_tokens, output_tokens, entity_refs, latency_ms, redactions_applied, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
       RETURNING id`,
      [
        params.tenantId,
        params.userId,
        params.feature,
        model,
        opts.status,
        opts.blockReason ?? null,
        opts.inputTokens ?? 0,
        opts.outputTokens ?? 0,
        JSON.stringify(params.entityRefs ?? []),
        opts.latencyMs ?? null,
        opts.redactions ?? 0,
        opts.error ?? null,
      ],
    );
    return rows[0]!.id;
  }
}

/** Rough token estimate for the pre-flight budget gate (~1.3 tokens/word). */
function estimateTokens(text: string): number {
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}
