"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Copy, CornerDownLeft, MessageSquare, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { unwrap } from "@kaenal/api-client";
import type { CommentDto } from "@kaenal/types";
import { getApiClient } from "@/lib/api";
import { entityHref, entityLabel } from "@/lib/entity-routes";
import { Button, useToast } from "@/components/ui";
import { AiPdfAction } from "./ai-pdf-action";
import { useAiFieldTarget } from "./use-ai-field-target";
import type { ChatMessage } from "./use-ai-chat";

export function AiAvatar({ size = 26 }: { size?: number }): React.ReactElement {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-sm text-white"
      style={{ width: size, height: size, background: "var(--ai-gradient)" }}
    >
      <Sparkles size={size >= 30 ? 16 : 12} />
    </div>
  );
}

/** Trust components: confidence label with a colour AND a word (never colour alone). */
function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }): React.ReactElement {
  const t = useTranslations("ai");
  const tone = level === "high" ? "var(--success-600)" : level === "medium" ? "var(--warning-600)" : "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ color: tone }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
      {t(`confidence.${level}`)}
    </span>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
  title,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  title?: string | undefined;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} title={title} disabled={disabled ?? false}>
      {icon}
      {children}
    </Button>
  );
}

/** Reply action row: Copy / Pin to entity / Insert into field / Generate PDF. */
function ReplyActions({ message }: { message: ChatMessage }): React.ReactElement | null {
  const t = useTranslations("ai");
  const router = useRouter();
  const toast = useToast();
  const field = useAiFieldTarget();
  const provenance = message.provenance;
  const entityRef = message.entityRef;

  const pin = useMutation({
    mutationFn: (entity: NonNullable<ChatMessage["entityRef"]>) =>
      getApiClient()
        .createComment({
          body: {
            entityKind: entity.kind,
            entityId: entity.id,
            // Honest provenance travels with the pinned text.
            body: `${t("pinPrefix", { provider: provenance?.provider ?? "" })}\n${message.text}`.slice(0, 4000),
          },
        })
        .then((r) => unwrap<CommentDto>(r)),
    onSuccess: () => toast.success(t("pinned")),
    onError: () => toast.error(t("pinFailed")),
  });

  if (provenance === undefined) return null;

  const copy = (): void => {
    void navigator.clipboard.writeText(message.text).then(
      () => toast.success(t("copied")),
      () => toast.error(t("copyFailed")),
    );
  };

  const insert = (): void => {
    if (field.insert(message.text)) toast.success(t("inserted"));
    else toast.toast(t("noField"), "info");
  };

  const pinnedHref = entityRef !== undefined ? entityHref(entityRef.kind, entityRef.id) : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <ActionButton onClick={copy} icon={<Copy size={13} aria-hidden />}>
        {t("copy")}
      </ActionButton>
      {entityRef !== undefined &&
        (pin.isSuccess ? (
          <>
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-success-600">
              <Check size={13} aria-hidden />
              {t("pinnedShort")}
            </span>
            {pinnedHref !== null && (
              <Button size="sm" variant="plain" onClick={() => router.push(pinnedHref)}>
                <MessageSquare size={13} aria-hidden />
                {t("viewComment")}
              </Button>
            )}
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            loading={pin.isPending}
            onClick={() => pin.mutate(entityRef)}
            title={t("pinTip", { kind: entityLabel(entityRef.kind) })}
          >
            <MessageSquare size={13} aria-hidden />
            {t("pin")}
          </Button>
        ))}
      <ActionButton
        onClick={insert}
        icon={<CornerDownLeft size={13} aria-hidden />}
        title={field.hasField ? undefined : t("noFieldTip")}
      >
        {t("insert")}
      </ActionButton>
      <AiPdfAction text={message.text} provenance={provenance} />
    </div>
  );
}

/** In-stream / transport failure: real message, request id, Try again. Never a fake reply. */
function ErrorBody({ message, onRetry }: { message: ChatMessage; onRetry: () => void }): React.ReactElement {
  const t = useTranslations("ai");
  const toast = useToast();
  const error = message.error;
  if (error === undefined) return <></>;
  const known = ["AI_UNAVAILABLE", "ENTITLEMENT_REQUIRED", "BUDGET_EXCEEDED", "AI_DISABLED", "REGION_LOCKED", "OFFLINE", "NETWORK", "FORBIDDEN", "NOT_FOUND"];
  const text = known.includes(error.code) ? t(`errors.${error.code}`) : error.message;
  // Retrying cannot fix a governance refusal.
  const retryable = !["BUDGET_EXCEEDED", "AI_DISABLED", "ENTITLEMENT_REQUIRED", "REGION_LOCKED", "FORBIDDEN"].includes(error.code);
  return (
    <div className="mt-1">
      <div className="flex items-start gap-1.5 font-semibold" style={{ color: "var(--danger-600)" }}>
        <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span>{text}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {retryable && (
          <ActionButton onClick={onRetry} icon={<RotateCcw size={13} aria-hidden />}>
            {t("tryAgain")}
          </ActionButton>
        )}
        {error.requestId !== null && (
          <ActionButton
            onClick={() => {
              void navigator.clipboard.writeText(error.requestId ?? "").then(() => toast.success(t("requestIdCopied")));
            }}
            icon={<Copy size={13} aria-hidden />}
          >
            {t("copyRequestId")}
          </ActionButton>
        )}
      </div>
      {error.requestId !== null && (
        <div className="mono mt-1.5 text-[10.5px] text-muted">
          {t("requestId")}: {error.requestId}
        </div>
      )}
    </div>
  );
}

/** One chat bubble (ai.jsx AIDrawer message) plus the reply's trust row and actions. */
export function AiMessage({ message, onRetry }: { message: ChatMessage; onRetry: () => void }): React.ReactElement {
  const t = useTranslations("ai");
  if (message.role === "user") {
    return (
      <div className="flex flex-row-reverse items-start gap-2">
        <div
          className="max-w-[82%] whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-normal"
          style={{ borderRadius: "12px 12px 2px 12px", background: "var(--accent)", color: "var(--surface)" }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  const provenance = message.provenance;
  return (
    <div className="flex items-start gap-2">
      <AiAvatar />
      <div
        className="min-w-0 max-w-[82%] bg-bg-subtle px-3 py-2.5 text-[13px] leading-normal"
        style={{ borderRadius: "12px 12px 12px 2px" }}
      >
        {message.status === "streaming" && message.text === "" ? (
          <span className="flex gap-1 py-1" role="status" aria-label={t("thinking")}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--text-muted)", animation: `pulseDot 1.4s ${i * 0.2}s infinite` }}
              />
            ))}
          </span>
        ) : (
          <div className="whitespace-pre-wrap">{message.text}</div>
        )}
        {message.status === "stopped" && <div className="mt-1 text-[11px] text-muted">{t("stopped")}</div>}
        {message.status === "error" && <ErrorBody message={message} onRetry={onRetry} />}
        {provenance !== undefined && message.status === "done" && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ConfidenceChip level={provenance.confidence} />
              {provenance.sources.map((s) => {
                const href = entityHref(s.kind, s.id);
                const label = `${entityLabel(s.kind)} · ${s.id.slice(0, 8)}`;
                const cls = "rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] text-muted";
                return href !== null ? (
                  <Link key={`${s.kind}:${s.id}`} href={href} className={cls}>
                    {label}
                  </Link>
                ) : (
                  <span key={`${s.kind}:${s.id}`} className={cls}>
                    {label}
                  </span>
                );
              })}
              <span className="text-[10.5px] text-muted" title={t("providerTip")}>
                {t("provider", { provider: provenance.provider })}
              </span>
            </div>
            <ReplyActions message={message} />
          </>
        )}
      </div>
    </div>
  );
}
