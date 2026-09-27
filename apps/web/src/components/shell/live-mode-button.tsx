"use client";

import { useTranslations } from "next-intl";
import { useOnline } from "@/hooks/use-online";
import { useLiveStore } from "@/stores/live";
import { Tooltip } from "@/components/ui";

/**
 * Top-bar live-mode toggle (realtime-empty-skel.jsx LiveModeButton, S1-3).
 * States: off, on, reconnecting (SSE dropped, auto-retrying) and paused
 * (browser offline: explains itself instead of a dead click). Below `sm` only
 * the dot shows (W9-A).
 */
export function LiveModeButton({ userId }: { userId: string }): React.ReactElement {
  const t = useTranslations("live");
  const online = useOnline();
  const on = useLiveStore((s) => s.enabledByUser[userId] === true);
  const connection = useLiveStore((s) => s.connection);
  const setEnabled = useLiveStore((s) => s.setEnabled);

  const paused = on && !online;
  const reconnecting = on && online && connection === "reconnecting";
  const label = paused ? t("paused") : reconnecting ? t("reconnecting") : on ? t("on") : t("off");
  const tip = paused ? t("pausedTip") : reconnecting ? t("reconnectingTip") : on ? t("onTip") : t("offTip");

  const tone = paused || reconnecting ? "var(--warning-600)" : on ? "var(--success-600)" : "var(--text-muted)";
  // Paused (W5-D): a hollow ring, not a filled dot — distinguishes "waiting to
  // resume" from the solid off-state dot at a glance, colour never the only signal.
  const dotStyle: React.CSSProperties = paused
    ? { background: "transparent", border: "1.5px solid var(--text-subtle)" }
    : {
        background: reconnecting ? "var(--warning-500)" : on ? "var(--success-500)" : "var(--text-subtle)",
        animation: on && !reconnecting ? "pulseDot 1.6s ease-in-out infinite" : "none",
      };

  return (
    <Tooltip content={tip}>
      <button
        type="button"
        aria-pressed={on}
        aria-disabled={paused}
        aria-label={`${t("name")}: ${label}`}
        onClick={() => {
          if (!paused) setEnabled(userId, !on);
        }}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium"
        style={{
          color: tone,
          borderColor: on ? `color-mix(in srgb, ${tone} 30%, transparent)` : "var(--border)",
          background: on ? `color-mix(in srgb, ${tone} 10%, transparent)` : "transparent",
          cursor: paused ? "not-allowed" : "pointer",
        }}
      >
        <span aria-hidden className="h-2 w-2 rounded-full" style={dotStyle} />
        <span className="max-sm:hidden">{label}</span>
      </button>
    </Tooltip>
  );
}
