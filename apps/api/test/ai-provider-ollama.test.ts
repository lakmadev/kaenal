import { afterEach, describe, expect, it, vi } from "vitest";
import { OllamaAiProvider } from "../src/ai/provider.js";

/**
 * OllamaAiProvider unit test (06 §3) — the real local-model provider behind the
 * gateway's chokepoint port. We mock `fetch` so no live Ollama is needed: assert
 * it maps the routed label to a concrete model, attaches base64 images to the
 * user turn, posts to `/api/chat`, and maps the response (content + token counts).
 * The provider verified against a real qwen2.5vl:3b in-session; this locks the
 * request/response contract so a regression can't silently break it.
 */
describe("OllamaAiProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  interface OllamaBody {
    model: string;
    stream: boolean;
    messages: { role: string; content: string; images?: string[] }[];
    options: { num_predict: number };
  }

  it("maps the label to a model, attaches images, and returns the completion", async () => {
    const calls: { url: string; body: OllamaBody }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body: string }) => {
        calls.push({ url, body: JSON.parse(init.body) as OllamaBody });
        return {
          ok: true,
          json: async () => ({ message: { content: '{"title":"Weld crack"}' }, prompt_eval_count: 120, eval_count: 18 }),
        } as unknown as Response;
      }),
    );

    const provider = new OllamaAiProvider("http://localhost:11434/", {
      fast: "qwen2.5vl:3b",
      strong: "qwen2.5vl:3b",
      vision: "qwen2.5vl:3b",
    });

    const out = await provider.complete({
      model: "vision",
      system: "triage the defect",
      input: "note",
      maxTokens: 512,
      images: ["BASE64DATA"],
    });

    expect(out.text).toBe('{"title":"Weld crack"}');
    expect(out.inputTokens).toBe(120);
    expect(out.outputTokens).toBe(18);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://localhost:11434/api/chat");
    const body = calls[0]!.body;
    expect(body.model).toBe("qwen2.5vl:3b");
    expect(body.stream).toBe(false);
    // system + user turns; the image rides on the user turn.
    expect(body.messages[0]!.role).toBe("system");
    expect(body.messages[1]!.role).toBe("user");
    expect(body.messages[1]!.images).toEqual(["BASE64DATA"]);
    expect(body.options.num_predict).toBe(512);
  });

  it("throws on a non-OK response so the gateway records a soft failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, text: async () => "boom" }) as unknown as Response),
    );
    const provider = new OllamaAiProvider("http://localhost:11434", { fast: "m", strong: "m", vision: "m" });
    await expect(provider.complete({ model: "fast", system: "s", input: "i", maxTokens: 10 })).rejects.toThrow(/ollama 500/);
  });

  it("throws when the model returns empty content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "" } }) }) as unknown as Response),
    );
    const provider = new OllamaAiProvider("http://localhost:11434", { fast: "m", strong: "m", vision: "m" });
    await expect(provider.complete({ model: "fast", system: "s", input: "i", maxTokens: 10 })).rejects.toThrow(/no content/);
  });
});
