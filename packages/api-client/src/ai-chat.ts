import { AiChatChunk, type AiChatRequest } from "@kaenal/types";
import { buildHeaders, type ApiClientOptions } from "./client.js";

export interface StreamAiChatOptions {
  /** A fresh key per send; "Try again" must pass a NEW one (a replay is a 409). */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** The pre-stream failure (auth, RBAC, unknown entity ref, validation, replay). */
export class AiChatHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AiChatHttpError";
  }
}

/**
 * `POST /v1/ai/chat` — an SSE stream, so it sits outside the ts-rest contract
 * (plain controller route, like `/v1/events`). Yields validated
 * {@link AiChatChunk} frames: `delta`* then one `done` or `error`. Throws
 * {@link AiChatHttpError} when refused before streaming starts.
 */
export async function* streamAiChat(
  opts: ApiClientOptions,
  body: AiChatRequest,
  stream: StreamAiChatOptions = {},
): AsyncGenerator<AiChatChunk, void, undefined> {
  const headers = buildHeaders({ "content-type": "application/json", accept: "text/event-stream" }, "POST", opts);
  if (stream.idempotencyKey !== undefined) headers["idempotency-key"] = stream.idempotencyKey;

  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/v1/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    ...(opts.credentials !== undefined ? { credentials: opts.credentials } : {}),
    ...(stream.signal !== undefined ? { signal: stream.signal } : {}),
  });

  if (!res.ok || res.body === null) {
    let code = "INTERNAL";
    let message = res.statusText;
    try {
      const json = (await res.json()) as { error?: { code?: string; message?: string } };
      code = json.error?.code ?? code;
      message = json.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new AiChatHttpError(res.status, code, message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data !== "") yield AiChatChunk.parse(JSON.parse(data));
      sep = buffer.indexOf("\n\n");
    }
  }
}
