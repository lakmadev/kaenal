"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useCan } from "@/hooks/use-me";
import { useUiStore } from "@/lib/stores/ui";
import { useAiProminence } from "./use-ai-prominence";

/**
 * Top-bar AI button (shell.jsx:294-307). Prominence: `front` adds the "ON" chip,
 * `quiet` removes the button (the palette action still opens the drawer). Also
 * removed, never disabled, for a role without `ai:use` (partners).
 */
export function AiButton(): React.ReactElement | null {
  const t = useTranslations("ai");
  const allowed = useCan("ai:use");
  const prominence = useAiProminence();
  const open = useUiStore((s) => s.aiOpen);
  const setOpen = useUiStore((s) => s.setAiOpen);

  if (!allowed || prominence === "quiet") return null;

  return (
    <button
      type="button"
      aria-label={t("button")}
      aria-expanded={open}
      title={t("button")}
      onClick={() => setOpen(!open)}
      className="inline-flex h-[34px] items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium"
      style={{
        background: open ? "var(--accent)" : "var(--accent-soft)",
        color: open ? "var(--surface)" : "var(--text)",
        borderColor: open ? "var(--accent)" : "var(--border)",
      }}
    >
      <Sparkles size={15} strokeWidth={2} aria-hidden />
      <span className="max-sm:hidden">AI</span>
      {prominence === "front" && (
        <span
          className="rounded-[4px] px-[5px] py-px text-[10px] font-semibold max-sm:hidden"
          style={{ background: "rgba(255,255,255,0.25)" }}
        >
          ON
        </span>
      )}
    </button>
  );
}
