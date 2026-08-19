/**
 * The model-provider port (06 §3). The gateway is the ONE place that talks to a
 * model, and it does so only through this interface — NO other module imports an
 * Anthropic/OpenAI SDK (06 §3, the chokepoint rule). Production wires a provider
 * that maps the routed label ("fast"/"strong") to a concrete model and calls it;
 * the default here is a deterministic stub so the whole pipeline — gating,
 * redaction, ledger, budget — runs end to end without a provider credential.
 */

export interface AiCompletionRequest {
  /** Routed model label from `FEATURE_ROUTING` (e.g. "fast", "strong", "vision"). */
  readonly model: string;
  /** Versioned, feature-specific system prompt (assembled by the gateway). */
  readonly system: string;
  /** The user content — already PII-redacted by the gateway before it arrives. */
  readonly input: string;
  readonly maxTokens: number;
  /** Base64 images (no data: prefix) for a vision model — the defect photo. */
  readonly images?: readonly string[];
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

/**
 * Ollama-backed provider (06 §3) — a REAL local model behind the same port, so
 * self-hosting is a config flip, not a code change. Maps the routed label
 * ("fast"/"strong"/"vision") to a concrete Ollama model and calls the local
 * server's chat API; vision features attach base64 images to the user turn.
 * Still the ONLY place (besides the stub) that talks to a model. No SDK — a
 * plain fetch to `/api/chat`, so it needs no dependency and works offline-of-cloud.
 */
export class OllamaAiProvider implements AiProvider {
  readonly region: string;

  constructor(
    private readonly baseUrl: string,
    private readonly models: Record<string, string>,
    region = "local",
  ) {
    this.region = region;
  }

  async complete(req: AiCompletionRequest): Promise<AiCompletion> {
    const model = this.models[req.model] ?? this.models["fast"] ?? "qwen2.5vl:3b";
    const userTurn: { role: "user"; content: string; images?: string[] } = {
      role: "user",
      content: req.input.trim() === "" ? "Describe the attached image." : req.input,
    };
    if (req.images && req.images.length > 0) userTurn.images = [...req.images];

    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "system", content: req.system }, userTurn],
        options: { num_predict: req.maxTokens, temperature: 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    const json = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const text = json.message?.content ?? "";
    if (text.trim() === "") throw new Error("ollama returned no content");
    return {
      text,
      inputTokens: json.prompt_eval_count ?? wordCount(req.system) + wordCount(req.input),
      outputTokens: json.eval_count ?? wordCount(text),
    };
  }
}
