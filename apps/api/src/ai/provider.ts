/**
 * The model-provider port (06 §3). The gateway is the ONE place that talks to a
 * model, and it does so only through this interface — NO other module imports an
 * Anthropic/OpenAI SDK (06 §3, the chokepoint rule). Production wires a provider
 * that maps the routed label ("fast"/"strong") to a concrete model and calls it;
 * the default here is a deterministic stub so the whole pipeline — gating,
 * redaction, ledger, budget — runs end to end without a provider credential.
 */

export interface AiCompletionRequest {
  /** Routed model label from `FEATURE_ROUTING` (e.g. "fast", "strong"). */
  readonly model: string;
  /** Versioned, feature-specific system prompt (assembled by the gateway). */
  readonly system: string;
  /** The user content — already PII-redacted by the gateway before it arrives. */
  readonly input: string;
  readonly maxTokens: number;
}

export interface AiCompletion {
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AiProvider {
  /** The region this provider serves — the gateway checks it against a tenant's residency lock. */
  readonly region: string;
  complete(req: AiCompletionRequest): Promise<AiCompletion>;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Deterministic stub provider: "summarises" by taking the opening clause of the
 * input and reports token counts by word count. It is feature-agnostic (it only
 * sees the assembled system prompt + redacted input), so it exercises the
 * gateway's plumbing without pretending to be intelligent.
 */
export class StubAiProvider implements AiProvider {
  readonly region: string;

  constructor(region = "us-east-1") {
    this.region = region;
  }

  complete(req: AiCompletionRequest): Promise<AiCompletion> {
    const words = req.input.trim().split(/\s+/).filter(Boolean);
    const head = words.slice(0, 40).join(" ");
    const text = head === "" ? "(no content)" : `Summary: ${head}${words.length > 40 ? "…" : ""}`;
    return Promise.resolve({
      text,
      inputTokens: wordCount(req.system) + wordCount(req.input),
      outputTokens: wordCount(text),
    });
  }
}
