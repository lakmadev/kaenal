"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { entityHref, entityIcon, entityLabel } from "@/lib/entity-routes";
import { useLiveStore, type LiveToastItem } from "@/stores/live";
import { MemberCell } from "@/components/member-cell";

/** Left-border / icon tint per record kind (tokens only). */
const KIND_COLOR: Record<string, string> = {
  ncr: "var(--danger-600)",
  capa: "var(--warning-600)",
  inspection: "var(--info-600)",
  document: "var(--success-600)",
  supplier: "var(--info-600)",
};
const DEFAULT_COLOR = "var(--accent)";

function LiveToast({ item }: { item: LiveToastItem }): React.ReactElement {
  const t = useTranslations("live");
  const router = useRouter();
  const dismiss = useLiveStore((s) => s.dismissToast);
  const color = KIND_COLOR[item.entityKind] ?? DEFAULT_COLOR;
  const Icon = entityIcon(item.entityKind);
  const href = entityHref(item.entityKind, item.entityId);

  return (
    <div
      role="status"
      className="fade-in pointer-events-auto flex w-[min(380px,calc(100vw-32px))] items-start gap-2.5 rounded-md border border-border bg-surface p-3.5 shadow-xl"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon size={15} aria-hidden />
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
          style={{ background: "var(--success-500)", border: "2px solid var(--surface)" }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="text-[12.5px] font-bold">{item.title}</span>
          <span className="text-[10px] text-muted">· {t("justNow")}</span>
        </div>
        {item.body !== null && <div className="text-[11.5px] leading-normal text-muted">{item.body}</div>}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (href !== null) router.push(href);
              dismiss(item.id);
            }}
            className="rounded-sm text-[11.5px] font-semibold text-accent"
          >
            {t("view", { kind: entityLabel(item.entityKind) })} →
          </button>
          <div className="flex-1" />
          {item.actorId !== null && <MemberCell userId={item.actorId} size={14} firstNameOnly />}
        </div>
      </div>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={() => dismiss(item.id)}
        className="-ml-1 rounded-sm p-1 text-muted hover:text-text"
      >
        <X size={12} />
      </button>
    </div>
  );
}

/** Bottom-right stack of live-mode toasts (realtime-empty-skel.jsx LiveToastProvider). */
export function LiveToasts(): React.ReactElement | null {
  const toasts = useLiveStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[300] flex flex-col gap-2 max-sm:right-4">
      {toasts.map((item) => (
        <LiveToast key={item.id} item={item} />
      ))}
    </div>
  );
}
