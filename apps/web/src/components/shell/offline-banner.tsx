"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CloudOff, Check, RefreshCw } from "lucide-react";
import { nextConnectivity, type ConnectivityEvent, type ConnectivityPhase } from "@kaenal/core";
import { useOnline, useRetryConnection } from "@/hooks/use-online";
import { Spinner } from "@/components/ui";

/**
 * Global offline banner (W1-A..D), mounted once under the top bar. Phases come
 * from the pure `nextConnectivity` machine in core; this component only renders
 * them and forwards Retry. A polite live region announces every change.
 */
export function OfflineBanner(): React.ReactElement | null {
  const t = useTranslations("offline");
  const online = useOnline();
  const retry = useRetryConnection();
  const [phase, setPhase] = useState<ConnectivityPhase>("online");
  const [seenOnline, setSeenOnline] = useState(true);
  const [since, setSince] = useState(() => new Date());

  // Derive phase from connectivity during render (no effect needed).
  if (online !== seenOnline) {
    setSeenOnline(online);
    const event: ConnectivityEvent = online ? "went-online" : "went-offline";
    if (!online) setSince(new Date());
    setPhase(nextConnectivity(phase, event));
  }

  // Effect justified: the "Up to date" banner auto-dismisses after 3s (timer).
  useEffect(() => {
    if (phase !== "restored") return;
    const id = setTimeout(() => setPhase((p) => nextConnectivity(p, "dismiss")), 3000);
    return () => clearTimeout(id);
  }, [phase]);

  async function onRetry(): Promise<void> {
    setPhase((p) => nextConnectivity(p, "retry"));
    const ok = await retry();
    setPhase((p) => nextConnectivity(p, ok ? "went-online" : "retry-failed"));
  }

  const time = since.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div aria-live="polite" role="status">
      {phase !== "online" && (
        <div
          className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2 text-[13px]"
          style={
            phase === "restored"
              ? { background: "var(--success-bg)", color: "var(--success-fg)" }
              : { background: "var(--warn-bg)", color: "var(--warn-fg)" }
          }
        >
          {phase === "restored" ? <Check size={16} aria-hidden /> : <CloudOff size={16} aria-hidden />}
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">
              {phase === "restored" ? t("restoredTitle") : phase === "checking" ? t("checking") : t("titleOffline")}
            </strong>
            {phase === "offline" && <span> — {t("bodyOffline", { time })}</span>}
            {phase === "restored" && <span> — {t("restoredBody")}</span>}
          </span>
          {phase === "restored" ? (
            <span className="text-[12px] font-semibold">{t("upToDate")}</span>
          ) : (
            <button
              type="button"
              onClick={() => void onRetry()}
              disabled={phase === "checking"}
              className="k-btn k-btn-ghost k-btn-sm"
            >
              {phase === "checking" ? <Spinner size={13} /> : <RefreshCw size={13} aria-hidden />}
              {t("retry")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
