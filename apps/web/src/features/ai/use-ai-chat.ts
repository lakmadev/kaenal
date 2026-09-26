"use client";

import { useRef, useState } from "react";
import { AiChatHttpError, streamAiChat } from "@kaenal/api-client";
import type { AiChatChunk, AiChatEntityRef, AiChatTurn } from "@kaenal/types";
import { getApiClientOptions } from "@/lib/api";

export type AiChatDone = Extract<AiChatChunk, { type: "done" }>;

/** Why a turn failed: an in-stream code, an HTTP refusal, or a transport problem. */
export interface AiChatFailure {
  code: string;
  message: string;
  requestId: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "streaming" | "done" | "stopped" | "error";
  /** Provenance from the final frame (assistant, done only). */
  provenance?: AiChatDone;
  error?: AiChatFailure | undefined;
  /** The user prompt an assistant message answers, so Try again can re-send it. */
  question?: string;
  entityRef?: AiChatEntityRef | undefined;
}

const MAX_HISTORY = 20;

function failureOf(e: unknown): AiChatFailure {
  if (e instanceof AiChatHttpError) return { code: e.code, message: e.message, requestId: null };
  if (e instanceof Error && e.name === "OfflineWriteError") {
    return { code: "OFFLINE", message: "You're offline.", requestId: null };
  }
  return { code: "NETWORK", message: "Couldn't reach Kaenal AI.", requestId: null };
}

/**
 * The chat turn state machine. Streams `POST /v1/ai/chat` via `streamAiChat`
 * (no business logic: the server assembles context, redacts and budgets). Nothing
 * is persisted; history is this drawer's own conversation, sent as prior turns.
 */
export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const counter = useRef(0);

  const streaming = messages.some((m) => m.status === "streaming");

  const patch = (id: string, change: Partial<ChatMessage>): void =>
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...change } : m)));

  /** Runs one turn into the assistant message `replyId`, using `history` as prior turns. */
  const run = async (
    replyId: string,
    text: string,
    entityRef: AiChatEntityRef | undefined,
    history: AiChatTurn[],
  ): Promise<void> => {
    const controller = new AbortController();
    abortRef.current = controller;
    let acc = "";
    try {
      const stream = streamAiChat(
        getApiClientOptions(),
        {
          message: text,
          ...(entityRef !== undefined ? { entityRef } : {}),
          ...(history.length > 0 ? { history } : {}),
        },
        // A fresh key per send AND per retry (a replayed key is a 409).
        { idempotencyKey: crypto.randomUUID(), signal: controller.signal },
      );
      for await (const chunk of stream) {
        if (chunk.type === "delta") {
          acc += chunk.text;
          patch(replyId, { text: acc });
        } else if (chunk.type === "done") {
          patch(replyId, { status: "done", text: acc, provenance: chunk });
        } else {
          patch(replyId, {
            status: "error",
            text: acc,
            error: { code: chunk.code, message: chunk.message, requestId: chunk.requestId },
          });
        }
      }
      // Stream closed without a done/error frame: treat as a transport failure.
      setMessages((all) =>
        all.map((m) =>
          m.id === replyId && m.status === "streaming"
            ? { ...m, status: "error", error: { code: "NETWORK", message: "The reply was interrupted.", requestId: null } }
            : m,
        ),
      );
    } catch (e) {
      if (controller.signal.aborted) {
        patch(replyId, { status: "stopped", text: acc });
      } else {
        patch(replyId, { status: "error", text: acc, error: failureOf(e) });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const historyBefore = (upTo: number): AiChatTurn[] =>
    messages
      .slice(0, upTo)
      .filter((m) => m.status === "done" || m.role === "user")
      .filter((m) => m.text.trim() !== "")
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.text.slice(0, 4000) }));

  const send = (text: string, entityRef: AiChatEntityRef | undefined): void => {
    const question = text.trim();
    if (question === "" || streaming) return;
    const n = ++counter.current;
    const replyId = `a${n}`;
    const history = historyBefore(messages.length);
    setMessages((all) => [
      ...all,
      { id: `u${n}`, role: "user", text: question, status: "done" },
      { id: replyId, role: "assistant", text: "", status: "streaming", question, entityRef },
    ]);
    void run(replyId, question, entityRef, history);
  };

  /** Try again: re-send the same question with a NEW idempotency key. */
  const retry = (replyId: string): void => {
    const index = messages.findIndex((m) => m.id === replyId);
    const target = messages[index];
    if (target?.question === undefined || streaming) return;
    const history = historyBefore(index - 1);
    patch(replyId, { status: "streaming", text: "", error: undefined });
    void run(replyId, target.question, target.entityRef, history);
  };

  const stop = (): void => abortRef.current?.abort();

  return { messages, streaming, send, retry, stop };
}
