"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Send, Square, X } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { useUiStore } from "@/lib/stores/ui";
import { Tooltip } from "@/components/ui";
import { AiAvatar, AiMessage } from "./ai-message";
import { useAiChat } from "./use-ai-chat";
import { useAiContext } from "./use-ai-context";

/**
 * The AI assistant drawer (ai.jsx AIDrawer, S1-4): right side, 420px (full
 * screen on phones), context-aware header, welcome bubble + suggestion chips,
 * streamed replies with provenance and actions, Stop while streaming, and an
 * input that is disabled with a reason while offline. The model is whatever the
 * API says it is: replies show their provider label, nothing is faked here.
 */
export function AiDrawer(): React.ReactElement | null {
  const open = useUiStore((s) => s.aiOpen);
  const setOpen = useUiStore((s) => s.setAiOpen);
  const t = useTranslations("ai");
  const online = useOnline();
  const context = useAiContext();
  const chat = useAiChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastText = chat.messages[chat.messages.length - 1]?.text;
  // Effect justified: scrolling is a DOM side effect that must run after the new
  // message/streamed chunk has rendered; no event handler fires at that moment.
  useEffect(() => {
    const el = scrollRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, lastText]);

  if (!open) return null;

  const send = (text: string): void => {
    if (!online || chat.streaming || text.trim() === "") return;
    setInput("");
    chat.send(text, context.entityRef, context.entityRef !== undefined ? context.label : undefined);
  };

  const suggestions = [
    t("suggestions.overdue"),
    context.entityRef !== undefined ? t("suggestions.blockingHere", { label: context.label }) : t("suggestions.blocking"),
    t("suggestions.problemStatement"),
    t("suggestions.topRisk"),
  ];
  const canSend = input.trim() !== "" && online && !chat.streaming;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      data-ai-drawer
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
      className="drawer-in fixed inset-y-0 right-0 z-[100] flex w-[420px] max-w-full flex-col border-l border-border bg-surface shadow-xl max-sm:w-full"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-[18px] py-3.5">
        <AiAvatar size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{t("title")}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="pulse-dot" aria-hidden />
            <span className="truncate">{t("contextAware", { label: context.label })}</span>
          </div>
        </div>
        <button type="button" aria-label={t("close")} onClick={() => setOpen(false)} className="k-btn k-btn-plain k-btn-icon">
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        <div className="flex items-start gap-2">
          <AiAvatar />
          <div
            className="max-w-[82%] bg-bg-subtle px-3 py-2.5 text-[13px] leading-normal"
            style={{ borderRadius: "12px 12px 12px 2px" }}
          >
            {t("welcome")}
          </div>
        </div>
        {chat.messages.map((m) => (
          <AiMessage key={m.id} message={m} onRetry={() => chat.retry(m.id)} />
        ))}
      </div>

      {chat.messages.length === 0 && (
        <div className="flex flex-col gap-1.5 px-4 pb-3.5 pt-2">
          <div className="k-overline">{t("suggested")}</div>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!online}
              onClick={() => send(s)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-left text-xs text-text hover:border-accent hover:bg-bg-subtle disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="relative"
        >
          <Tooltip content={t("offlineTip")} side="top">
            <input
              className="k-input h-[42px] pr-[42px]"
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              value={input}
              disabled={!online}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
          </Tooltip>
          {chat.streaming ? (
            <button
              type="button"
              aria-label={t("stop")}
              title={t("stop")}
              onClick={chat.stop}
              className="absolute right-[5px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm"
              style={{ background: "var(--accent)", color: "var(--surface)" }}
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label={t("send")}
              disabled={!canSend}
              className="absolute right-[5px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm"
              style={{
                background: input.trim() !== "" ? "var(--accent)" : "var(--bg-subtle)",
                color: input.trim() !== "" ? "var(--surface)" : "var(--text-subtle)",
              }}
            >
              <Send size={14} />
            </button>
          )}
        </form>
        <div className="mt-1.5 text-center text-[10px] text-subtle">{t("disclaimer")}</div>
      </div>
    </div>
  );
}
